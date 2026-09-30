/**
 * VeritaPay contract configuration.
 * Contract address is populated after deployment.
 * ABI is imported from the Foundry artifact.
 */

import { getUsdc, requireChain } from '@/onchain-facts'

export const TARGET_CHAIN_ID = 5042002 // Arc Testnet

export const ARC_CHAIN = requireChain(TARGET_CHAIN_ID)
export const USDC_FACT = getUsdc(TARGET_CHAIN_ID)!

export const VERITAPAY_ADDRESS = (
  import.meta.env.VITE_VERITAPAY_ADDRESS ?? ''
) as `0x${string}`

// ABI — full contract interface
export const VERITAPAY_ABI = [
  // Enums — PeriodState: 0=PENDING,1=ATTESTED,2=SETTLED,3=DISPUTED,4=RESOLVED,5=MISSED
  // Read functions
  { inputs: [], name: 'getAllServiceIds', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'serviceId', type: 'uint256' }], name: 'getServiceListing', outputs: [{ type: 'tuple', components: [
    { name: 'vendor', type: 'address' }, { name: 'name', type: 'string' }, { name: 'metadataUri', type: 'string' },
    { name: 'pricePerPeriod', type: 'uint256' }, { name: 'periodDuration', type: 'uint32' },
    { name: 'challengeWindow', type: 'uint32' }, { name: 'gracePeriod', type: 'uint32' },
    { name: 'targetUptimeBps', type: 'uint16' }, { name: 'active', type: 'bool' }, { name: 'createdAt', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'getSubscription', outputs: [{ type: 'tuple', components: [
    { name: 'serviceId', type: 'uint256' }, { name: 'subscriber', type: 'address' },
    { name: 'budgetPerPeriod', type: 'uint256' }, { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' }, { name: 'active', type: 'bool' },
    { name: 'totalPaid', type: 'uint256' }, { name: 'totalPeriods', type: 'uint256' },
    { name: 'honestPeriods', type: 'uint256' }, { name: 'lastProcessedPeriodIndex', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }], name: 'getPeriod', outputs: [{ type: 'tuple', components: [
    { name: 'subscriptionId', type: 'uint256' }, { name: 'periodIndex', type: 'uint256' },
    { name: 'periodStart', type: 'uint256' }, { name: 'periodEnd', type: 'uint256' },
    { name: 'state', type: 'uint8' }, { name: 'uptimeBps', type: 'uint16' },
    { name: 'latencyP99Ms', type: 'uint32' }, { name: 'errorRateBps', type: 'uint16' },
    { name: 'performanceScore', type: 'uint256' }, { name: 'paymentAmount', type: 'uint256' },
    { name: 'evidenceHash', type: 'bytes32' }, { name: 'attestedAt', type: 'uint256' },
    { name: 'settledAt', type: 'uint256' }, { name: 'disputeReason', type: 'string' },
    { name: 'disputedAt', type: 'uint256' }
  ]}], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'vendor', type: 'address' }], name: 'getVendorReputation', outputs: [
    { name: 'score', type: 'uint256' }, { name: 'honored', type: 'uint256' },
    { name: 'total', type: 'uint256' }, { name: 'totalServices', type: 'uint256' }
  ], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'subscriber', type: 'address' }], name: 'getActiveSubscriptions', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'vendor', type: 'address' }], name: 'getVendorServices', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'getSubscriptionPeriods', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'getCurrentPeriodIndex', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'vendorStats', outputs: [
    { name: 'honoredPeriods', type: 'uint256' }, { name: 'totalPeriods', type: 'uint256' }, { name: 'totalServices', type: 'uint256' }
  ], stateMutability: 'view', type: 'function' },
  // Write functions
  { inputs: [
    { name: 'name', type: 'string' }, { name: 'metadataUri', type: 'string' },
    { name: 'pricePerPeriod', type: 'uint256' }, { name: 'periodDuration', type: 'uint32' },
    { name: 'challengeWindow', type: 'uint32' }, { name: 'gracePeriod', type: 'uint32' },
    { name: 'targetUptimeBps', type: 'uint16' }
  ], name: 'registerService', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'serviceId', type: 'uint256' }, { name: 'metadataUri', type: 'string' }], name: 'updateServiceMetadata', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'serviceId', type: 'uint256' }], name: 'deactivateService', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
    { name: 'serviceId', type: 'uint256' }, { name: 'budgetPerPeriod', type: 'uint256' }, { name: 'duration', type: 'uint256' }
  ], name: 'subscribe', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'cancelSubscription', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
    { name: 'periodId', type: 'uint256' }, { name: 'uptimeBps', type: 'uint16' },
    { name: 'latencyP99Ms', type: 'uint32' }, { name: 'errorRateBps', type: 'uint16' }, { name: 'evidenceHash', type: 'bytes32' }
  ], name: 'submitAttestation', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }], name: 'triggerAutoSettle', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }], name: 'markMissed', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }, { name: 'reason', type: 'string' }], name: 'disputePeriod', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }, { name: 'vendorFaultBps', type: 'uint256' }, { name: 'reason', type: 'string' }], name: 'resolveDispute', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'periodId', type: 'uint256' }], name: 'autoResolveDispute', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'subscriptionId', type: 'uint256' }], name: 'syncCurrentPeriod', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'serviceId', type: 'uint256' }, { indexed: true, name: 'vendor', type: 'address' }, { indexed: false, name: 'name', type: 'string' }, { indexed: false, name: 'pricePerPeriod', type: 'uint256' }], name: 'ServiceRegistered', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'subscriptionId', type: 'uint256' }, { indexed: true, name: 'serviceId', type: 'uint256' }, { indexed: true, name: 'subscriber', type: 'address' }, { indexed: false, name: 'budgetPerPeriod', type: 'uint256' }], name: 'Subscribed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'periodId', type: 'uint256' }, { indexed: true, name: 'subscriptionId', type: 'uint256' }, { indexed: false, name: 'performanceScore', type: 'uint256' }, { indexed: false, name: 'paymentAmount', type: 'uint256' }], name: 'AttestationSubmitted', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'periodId', type: 'uint256' }, { indexed: true, name: 'subscriptionId', type: 'uint256' }, { indexed: true, name: 'vendor', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'PeriodSettled', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'periodId', type: 'uint256' }, { indexed: true, name: 'subscriptionId', type: 'uint256' }], name: 'PeriodMissed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'periodId', type: 'uint256' }, { indexed: true, name: 'subscriber', type: 'address' }, { indexed: false, name: 'reason', type: 'string' }], name: 'PeriodDisputed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'vendor', type: 'address' }, { indexed: false, name: 'score', type: 'uint256' }, { indexed: false, name: 'honored', type: 'uint256' }, { indexed: false, name: 'total', type: 'uint256' }], name: 'ReputationUpdated', type: 'event' },
  // Errors
  { inputs: [], name: 'NotVendor', type: 'error' },
  { inputs: [], name: 'NotSubscriber', type: 'error' },
  { inputs: [{ name: 'current', type: 'uint8' }], name: 'InvalidState', type: 'error' },
  { inputs: [], name: 'ChallengeWindowOpen', type: 'error' },
  { inputs: [], name: 'GracePeriodActive', type: 'error' },
  { inputs: [], name: 'AlreadyAttested', type: 'error' },
  { inputs: [], name: 'Unauthorized', type: 'error' },
  { inputs: [], name: 'InvalidAmount', type: 'error' },
  { inputs: [], name: 'ServiceNotActive', type: 'error' },
  { inputs: [{ name: 'required', type: 'uint256' }, { name: 'available', type: 'uint256' }], name: 'InsufficientAllowance', type: 'error' },
  { inputs: [], name: 'ZeroAddress', type: 'error' },
  { inputs: [], name: 'NotFound', type: 'error' },
  { inputs: [], name: 'ServiceHasActiveSubscriptions', type: 'error' },
  { inputs: [], name: 'ChallengeWindowExpired', type: 'error' },
  { inputs: [], name: 'InvalidParameter', type: 'error' },
] as const

export const PERIOD_STATE_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Attested',
  2: 'Settled',
  3: 'Disputed',
  4: 'Resolved',
  5: 'Missed',
}

export const PERIOD_STATE_CLASS: Record<number, string> = {
  0: 'badge-pending',
  1: 'badge-attested',
  2: 'badge-settled',
  3: 'badge-disputed',
  4: 'badge-resolved',
  5: 'badge-missed',
}

export function formatScorePct(scoreBps: bigint | number): string {
  const n = typeof scoreBps === 'bigint' ? Number(scoreBps) : scoreBps
  return (n / 100).toFixed(2) + '%'
}

export function scoreColor(scoreBps: bigint | number): string {
  const n = typeof scoreBps === 'bigint' ? Number(scoreBps) : scoreBps
  if (n >= 9500) return 'var(--score-high)'
  if (n >= 8000) return 'var(--score-mid)'
  return 'var(--score-low)'
}
