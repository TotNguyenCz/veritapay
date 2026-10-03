// SPDX-License-Identifier: MIT
// VeritaPay — Performance-Attested Subscription Billing on Arc Testnet
// Vendor submits signed performance attestations each billing period.
// USDC auto-settles proportionally after an uncontested challenge window.
// Subscriber reputation scores are public on-chain — any contract can read them.
// Redeployed: 2026-10-03 (fresh state)
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VeritaPay is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant HONEST_THRESHOLD_BPS = 9_500;
    uint32 private constant DEFAULT_CHALLENGE_WINDOW = 48 hours;
    uint32 private constant MIN_CHALLENGE_WINDOW = 1 hours;
    uint32 private constant MAX_CHALLENGE_WINDOW = 7 days;
    uint32 private constant MIN_GRACE_PERIOD = 1 hours;
    uint32 private constant MAX_GRACE_PERIOD = 30 days;
    uint32 private constant DISPUTE_TIMEOUT = 7 days;

    enum PeriodState {
        PENDING,
        ATTESTED,
        SETTLED,
        DISPUTED,
        RESOLVED,
        MISSED
    }

    struct ServiceListing {
        address vendor;
        string name;
        string metadataUri;
        uint256 pricePerPeriod;
        uint32 periodDuration;
        uint32 challengeWindow;
        uint32 gracePeriod;
        uint16 targetUptimeBps;
        bool active;
        uint256 createdAt;
    }

    struct Subscription {
        uint256 serviceId;
        address subscriber;
        uint256 budgetPerPeriod;
        uint256 startTime;
        uint256 endTime;
        bool active;
        uint256 totalPaid;
        uint256 totalPeriods;
        uint256 honestPeriods;
        uint256 lastProcessedPeriodIndex;
    }

    struct Period {
        uint256 subscriptionId;
        uint256 periodIndex;
        uint256 periodStart;
        uint256 periodEnd;
        PeriodState state;
        uint16 uptimeBps;
        uint32 latencyP99Ms;
        uint16 errorRateBps;
        uint256 performanceScore;
        uint256 paymentAmount;
        bytes32 evidenceHash;
        uint256 attestedAt;
        uint256 settledAt;
        uint256 disputedAt;
        string disputeReason;
    }

    struct VendorStats {
        uint256 honoredPeriods;
        uint256 totalPeriods;
        uint256 totalServices;
    }

    error NotVendor();
    error NotSubscriber();
    error InvalidState(PeriodState current);
    error ChallengeWindowOpen();
    error GracePeriodActive();
    error AlreadyAttested();
    error Unauthorized();
    error InvalidAmount();
    error ServiceNotActive();
    error InsufficientAllowance(uint256 required, uint256 available);
    error ZeroAddress();
    error NotFound();
    error ServiceHasActiveSubscriptions();
    error ChallengeWindowExpired();
    error InvalidParameter();
    error SubscriberPaymentDefaulted(uint256 periodId);

    event ServiceRegistered(uint256 indexed serviceId, address indexed vendor, string name, uint256 pricePerPeriod);
    event ServiceUpdated(uint256 indexed serviceId, string metadataUri);
    event ServiceDeactivated(uint256 indexed serviceId);
    event Subscribed(uint256 indexed subscriptionId, uint256 indexed serviceId, address indexed subscriber, uint256 budgetPerPeriod);
    event SubscriptionCancelled(uint256 indexed subscriptionId);
    event AttestationSubmitted(uint256 indexed periodId, uint256 indexed subscriptionId, uint256 performanceScore, uint256 paymentAmount);
    event PeriodSettled(uint256 indexed periodId, uint256 indexed subscriptionId, address indexed vendor, uint256 amount);
    event PeriodMissed(uint256 indexed periodId, uint256 indexed subscriptionId);
    event PeriodDisputed(uint256 indexed periodId, address indexed subscriber, string reason);
    event DisputeResolved(uint256 indexed periodId, uint256 vendorFaultBps, uint256 finalPayment);
    event ReputationUpdated(address indexed vendor, uint256 score, uint256 honored, uint256 total);
    event SubscriberDefaulted(uint256 indexed periodId, uint256 indexed subscriptionId, address indexed subscriber);

    IERC20 public immutable usdcToken;

    uint256 private _serviceCounter;
    uint256 private _subscriptionCounter;

    mapping(uint256 => ServiceListing) private _services;
    mapping(uint256 => Subscription) private _subscriptions;
    mapping(uint256 => Period) private _periods;
    mapping(uint256 => bool) private _periodExists;

    mapping(address => VendorStats) public vendorStats;

    mapping(uint256 => uint256[]) private _subscriptionPeriods;
    mapping(address => uint256[]) private _activeSubscriptions;
    mapping(address => mapping(uint256 => uint256)) private _activeSubscriptionIndex;
    mapping(address => uint256[]) private _vendorServices;
    mapping(uint256 => uint256) private _activeSubscriptionsPerService;
    uint256[] private _allServiceIds;

    constructor(address usdcToken_) Ownable(msg.sender) {
        if (usdcToken_ == address(0)) revert ZeroAddress();
        usdcToken = IERC20(usdcToken_);
    }

    function registerService(
        string calldata name,
        string calldata metadataUri,
        uint256 pricePerPeriod,
        uint32 periodDuration,
        uint32 challengeWindow,
        uint32 gracePeriod,
        uint16 targetUptimeBps
    ) external returns (uint256 serviceId) {
        if (pricePerPeriod == 0) revert InvalidAmount();
        if (periodDuration < 1 days) revert InvalidParameter();
        if (targetUptimeBps == 0 || targetUptimeBps > BPS_DENOMINATOR) revert InvalidParameter();

        uint32 effectiveChallengeWindow = challengeWindow == 0 ? DEFAULT_CHALLENGE_WINDOW : challengeWindow;
        if (effectiveChallengeWindow < MIN_CHALLENGE_WINDOW || effectiveChallengeWindow > MAX_CHALLENGE_WINDOW) {
            revert InvalidParameter();
        }
        if (gracePeriod < MIN_GRACE_PERIOD || gracePeriod > MAX_GRACE_PERIOD) revert InvalidParameter();

        serviceId = ++_serviceCounter;
        _services[serviceId] = ServiceListing({
            vendor: msg.sender,
            name: name,
            metadataUri: metadataUri,
            pricePerPeriod: pricePerPeriod,
            periodDuration: periodDuration,
            challengeWindow: effectiveChallengeWindow,
            gracePeriod: gracePeriod,
            targetUptimeBps: targetUptimeBps,
            active: true,
            createdAt: block.timestamp
        });

        _allServiceIds.push(serviceId);
        _vendorServices[msg.sender].push(serviceId);
        vendorStats[msg.sender].totalServices += 1;

        emit ServiceRegistered(serviceId, msg.sender, name, pricePerPeriod);
    }

    function updateServiceMetadata(uint256 serviceId, string calldata metadataUri) external {
        ServiceListing storage service = _services[serviceId];
        if (service.vendor == address(0)) revert NotFound();
        if (service.vendor != msg.sender) revert NotVendor();

        service.metadataUri = metadataUri;
        emit ServiceUpdated(serviceId, metadataUri);
    }

    function deactivateService(uint256 serviceId) external {
        ServiceListing storage service = _services[serviceId];
        if (service.vendor == address(0)) revert NotFound();
        if (service.vendor != msg.sender) revert NotVendor();
        if (_activeSubscriptionsPerService[serviceId] != 0) revert ServiceHasActiveSubscriptions();

        service.active = false;
        emit ServiceDeactivated(serviceId);
    }

    function subscribe(uint256 serviceId, uint256 budgetPerPeriod, uint256 duration)
        external
        nonReentrant
        returns (uint256 subscriptionId)
    {
        ServiceListing storage service = _services[serviceId];
        if (service.vendor == address(0)) revert NotFound();
        if (!service.active) revert ServiceNotActive();
        if (budgetPerPeriod == 0 || budgetPerPeriod > (service.pricePerPeriod * 2)) revert InvalidAmount();

        subscriptionId = ++_subscriptionCounter;
        uint256 startTime = block.timestamp;
        uint256 endTime = duration == 0 ? 0 : startTime + duration;

        _subscriptions[subscriptionId] = Subscription({
            serviceId: serviceId,
            subscriber: msg.sender,
            budgetPerPeriod: budgetPerPeriod,
            startTime: startTime,
            endTime: endTime,
            active: true,
            totalPaid: 0,
            totalPeriods: 0,
            honestPeriods: 0,
            lastProcessedPeriodIndex: 0
        });

        _activeSubscriptions[msg.sender].push(subscriptionId);
        _activeSubscriptionIndex[msg.sender][subscriptionId] = _activeSubscriptions[msg.sender].length;
        _activeSubscriptionsPerService[serviceId] += 1;

        _getOrCreateCurrentPeriod(subscriptionId);

        emit Subscribed(subscriptionId, serviceId, msg.sender, budgetPerPeriod);
    }

    function cancelSubscription(uint256 subscriptionId) external {
        Subscription storage subscription = _subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert NotFound();
        if (subscription.subscriber != msg.sender) revert NotSubscriber();
        if (!subscription.active) revert InvalidState(PeriodState.RESOLVED);

        subscription.active = false;
        if (subscription.endTime == 0 || subscription.endTime > block.timestamp) {
            subscription.endTime = block.timestamp;
        }

        _activeSubscriptionsPerService[subscription.serviceId] -= 1;
        _removeActiveSubscription(msg.sender, subscriptionId);

        emit SubscriptionCancelled(subscriptionId);
    }

    function submitAttestation(
        uint256 periodId,
        uint16 uptimeBps,
        uint32 latencyP99Ms,
        uint16 errorRateBps,
        bytes32 evidenceHash
    ) external {
        if (!_periodExists[periodId]) revert NotFound();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.PENDING) {
            if (period.state == PeriodState.ATTESTED) revert AlreadyAttested();
            revert InvalidState(period.state);
        }

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        if (service.vendor != msg.sender) revert NotVendor();
        if (block.timestamp < period.periodEnd) revert InvalidState(period.state);
        if (block.timestamp > period.periodEnd + service.gracePeriod) revert GracePeriodActive();
        if (uptimeBps > BPS_DENOMINATOR || errorRateBps > BPS_DENOMINATOR) revert InvalidAmount();

        uint256 rawScore = (uint256(uptimeBps) * BPS_DENOMINATOR) / service.targetUptimeBps;
        uint256 performanceScore = rawScore > BPS_DENOMINATOR ? BPS_DENOMINATOR : rawScore;

        uint256 baseAmount = subscription.budgetPerPeriod < service.pricePerPeriod
            ? subscription.budgetPerPeriod
            : service.pricePerPeriod;
        uint256 paymentAmount = (baseAmount * performanceScore) / BPS_DENOMINATOR;

        period.uptimeBps = uptimeBps;
        period.latencyP99Ms = latencyP99Ms;
        period.errorRateBps = errorRateBps;
        period.performanceScore = performanceScore;
        period.paymentAmount = paymentAmount;
        period.evidenceHash = evidenceHash;
        period.attestedAt = block.timestamp;
        period.state = PeriodState.ATTESTED;

        emit AttestationSubmitted(periodId, period.subscriptionId, performanceScore, paymentAmount);
    }

    function triggerAutoSettle(uint256 periodId) external nonReentrant {
        if (!_periodExists[periodId]) revert NotFound();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.ATTESTED) revert InvalidState(period.state);

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        if (block.timestamp <= period.attestedAt + service.challengeWindow) revert ChallengeWindowOpen();

        uint256 settledAmount = period.paymentAmount;
        bool honored = period.performanceScore >= HONEST_THRESHOLD_BPS;

        if (settledAmount > 0) {
            uint256 allowed = usdcToken.allowance(subscription.subscriber, address(this));
            if (allowed < settledAmount) {
                emit SubscriberDefaulted(periodId, period.subscriptionId, subscription.subscriber);
                settledAmount = 0;
                honored = false;
            } else {
                _transferWithAllowanceCheck(subscription.subscriber, service.vendor, settledAmount);
            }
        }

        period.paymentAmount = settledAmount;
        period.state = PeriodState.SETTLED;
        period.settledAt = block.timestamp;

        _updateStats(subscription, service.vendor, settledAmount, honored);

        emit PeriodSettled(periodId, period.subscriptionId, service.vendor, settledAmount);

        _getOrCreateCurrentPeriod(period.subscriptionId);
    }

    function markMissed(uint256 periodId) external {
        if (!_periodExists[periodId]) revert NotFound();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.PENDING) revert InvalidState(period.state);

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        if (block.timestamp <= period.periodEnd + service.gracePeriod) revert GracePeriodActive();

        period.state = PeriodState.MISSED;
        period.settledAt = block.timestamp;

        _updateStats(subscription, service.vendor, 0, false);

        emit PeriodMissed(periodId, period.subscriptionId);

        _getOrCreateCurrentPeriod(period.subscriptionId);
    }

    function disputePeriod(uint256 periodId, string calldata reason) external {
        if (!_periodExists[periodId]) revert NotFound();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.ATTESTED) revert InvalidState(period.state);

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        if (subscription.subscriber != msg.sender) revert NotSubscriber();
        if (block.timestamp > period.attestedAt + service.challengeWindow) revert ChallengeWindowExpired();

        period.state = PeriodState.DISPUTED;
        period.disputedAt = block.timestamp;
        period.disputeReason = reason;

        emit PeriodDisputed(periodId, msg.sender, reason);
    }

    function resolveDispute(uint256 periodId, uint256 vendorFaultBps, string calldata reason)
        external
        onlyOwner
        nonReentrant
    {
        if (!_periodExists[periodId]) revert NotFound();
        if (vendorFaultBps > BPS_DENOMINATOR) revert InvalidAmount();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.DISPUTED) revert InvalidState(period.state);

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        uint256 finalPayment = (period.paymentAmount * (BPS_DENOMINATOR - vendorFaultBps)) / BPS_DENOMINATOR;
        period.paymentAmount = finalPayment;
        period.disputeReason = reason;

        if (finalPayment > 0) {
            _transferWithAllowanceCheck(subscription.subscriber, service.vendor, finalPayment);
        }

        period.state = PeriodState.RESOLVED;
        period.settledAt = block.timestamp;

        bool honored = vendorFaultBps < 5_000;
        _updateStats(subscription, service.vendor, finalPayment, honored);

        emit DisputeResolved(periodId, vendorFaultBps, finalPayment);

        _getOrCreateCurrentPeriod(period.subscriptionId);
    }

    function autoResolveDispute(uint256 periodId) external {
        if (!_periodExists[periodId]) revert NotFound();

        Period storage period = _periods[periodId];
        if (period.state != PeriodState.DISPUTED) revert InvalidState(period.state);
        if (block.timestamp <= period.disputedAt + DISPUTE_TIMEOUT) revert ChallengeWindowOpen();

        Subscription storage subscription = _subscriptions[period.subscriptionId];
        ServiceListing storage service = _services[subscription.serviceId];

        period.paymentAmount = 0;
        period.state = PeriodState.RESOLVED;
        period.settledAt = block.timestamp;

        _updateStats(subscription, service.vendor, 0, false);

        emit DisputeResolved(periodId, BPS_DENOMINATOR, 0);

        _getOrCreateCurrentPeriod(period.subscriptionId);
    }

    function syncCurrentPeriod(uint256 subscriptionId) external returns (uint256) {
        return _getOrCreateCurrentPeriod(subscriptionId);
    }

    function getVendorReputation(address vendor)
        external
        view
        returns (uint256 score, uint256 honored, uint256 total, uint256 totalServices)
    {
        VendorStats memory stats = vendorStats[vendor];
        honored = stats.honoredPeriods;
        total = stats.totalPeriods;
        totalServices = stats.totalServices;
        score = ((honored + 2) * BPS_DENOMINATOR) / (total + 3);
    }

    function getServiceListing(uint256 serviceId) external view returns (ServiceListing memory) {
        return _services[serviceId];
    }

    function getSubscription(uint256 subscriptionId) external view returns (Subscription memory) {
        return _subscriptions[subscriptionId];
    }

    function getPeriod(uint256 periodId) external view returns (Period memory) {
        return _periods[periodId];
    }

    function getCurrentPeriodIndex(uint256 subscriptionId) public view returns (uint256) {
        Subscription memory subscription = _subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert NotFound();

        ServiceListing memory service = _services[subscription.serviceId];
        if (block.timestamp <= subscription.startTime) return 0;

        return (block.timestamp - subscription.startTime) / service.periodDuration;
    }

    function getAllServiceIds() external view returns (uint256[] memory) {
        return _allServiceIds;
    }

    function getSubscriptionPeriods(uint256 subscriptionId) external view returns (uint256[] memory) {
        return _subscriptionPeriods[subscriptionId];
    }

    function getActiveSubscriptions(address subscriber) external view returns (uint256[] memory) {
        return _activeSubscriptions[subscriber];
    }

    function getVendorServices(address vendor) external view returns (uint256[] memory) {
        return _vendorServices[vendor];
    }

    function _getOrCreateCurrentPeriod(uint256 subscriptionId) internal returns (uint256 periodId) {
        Subscription storage subscription = _subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert NotFound();

        ServiceListing storage service = _services[subscription.serviceId];
        uint256 currentPeriodIndex = getCurrentPeriodIndex(subscriptionId);
        uint256 startIndex = subscription.lastProcessedPeriodIndex;

        if (currentPeriodIndex > startIndex + 51) {
            currentPeriodIndex = startIndex + 51;
        }

        bool processedAny;

        for (uint256 periodIndex = startIndex; periodIndex <= currentPeriodIndex; periodIndex++) {
            uint256 periodStart = subscription.startTime + (periodIndex * service.periodDuration);
            if (subscription.endTime != 0 && periodStart >= subscription.endTime) {
                currentPeriodIndex = processedAny ? periodIndex - 1 : startIndex;
                break;
            }

            uint256 localPeriodId = _derivePeriodId(subscriptionId, periodIndex);

            if (!_periodExists[localPeriodId]) {
                uint256 periodEnd = periodStart + service.periodDuration;

                _periods[localPeriodId] = Period({
                    subscriptionId: subscriptionId,
                    periodIndex: periodIndex,
                    periodStart: periodStart,
                    periodEnd: periodEnd,
                    state: PeriodState.PENDING,
                    uptimeBps: 0,
                    latencyP99Ms: 0,
                    errorRateBps: 0,
                    performanceScore: 0,
                    paymentAmount: 0,
                    evidenceHash: bytes32(0),
                    attestedAt: 0,
                    settledAt: 0,
                    disputedAt: 0,
                    disputeReason: ""
                });

                _periodExists[localPeriodId] = true;
                _subscriptionPeriods[subscriptionId].push(localPeriodId);
            }

            Period storage period = _periods[localPeriodId];
            if (period.state == PeriodState.PENDING && block.timestamp > period.periodEnd + service.gracePeriod) {
                period.state = PeriodState.MISSED;
                period.settledAt = block.timestamp;
                _updateStats(subscription, service.vendor, 0, false);
                emit PeriodMissed(localPeriodId, subscriptionId);
            }

            periodId = localPeriodId;
            processedAny = true;
        }

        subscription.lastProcessedPeriodIndex = currentPeriodIndex;

        if (!processedAny) {
            return 0;
        }
    }

    function _derivePeriodId(uint256 subscriptionId, uint256 periodIndex) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(subscriptionId, periodIndex)));
    }

    function _updateStats(Subscription storage subscription, address vendor, uint256 paidAmount, bool honored) internal {
        subscription.totalPeriods += 1;
        if (paidAmount > 0) {
            subscription.totalPaid += paidAmount;
        }
        if (honored) {
            subscription.honestPeriods += 1;
        }

        VendorStats storage stats = vendorStats[vendor];
        stats.totalPeriods += 1;
        if (honored) {
            stats.honoredPeriods += 1;
        }

        uint256 score = ((stats.honoredPeriods + 2) * BPS_DENOMINATOR) / (stats.totalPeriods + 3);
        emit ReputationUpdated(vendor, score, stats.honoredPeriods, stats.totalPeriods);
    }

    function _transferWithAllowanceCheck(address from, address to, uint256 amount) internal {
        uint256 allowed = usdcToken.allowance(from, address(this));
        if (allowed < amount) revert InsufficientAllowance(amount, allowed);
        usdcToken.safeTransferFrom(from, to, amount);
    }

    function _removeActiveSubscription(address subscriber, uint256 subscriptionId) internal {
        uint256 indexPlusOne = _activeSubscriptionIndex[subscriber][subscriptionId];
        if (indexPlusOne == 0) {
            return;
        }

        uint256[] storage ids = _activeSubscriptions[subscriber];
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = ids.length - 1;

        if (index != lastIndex) {
            uint256 movedSubscriptionId = ids[lastIndex];
            ids[index] = movedSubscriptionId;
            _activeSubscriptionIndex[subscriber][movedSubscriptionId] = index + 1;
        }

        ids.pop();
        delete _activeSubscriptionIndex[subscriber][subscriptionId];
    }
}
