// Review footage and stored-clip capacity are separate from package entitlement.
// This does not reserve storage, charge a credit or verify media server-side.
export function reviewClipSelectionError(
  seconds: readonly number[],
  availableSlots: number,
) {
  if (!Number.isSafeInteger(availableSlots) || availableSlots < 0)
    return "Storage availability could not be confirmed. Refresh before preparing a review.";
  if (seconds.length < 1 || seconds.length > 3)
    return "Choose between one and three clips for this review.";
  if (seconds.length > availableSlots)
    return "There are not enough stored-clip spaces available. No review has been reserved.";
  if (
    seconds.some((value) => !Number.isFinite(value) || value <= 0 || value > 60)
  )
    return "Each review clip must be playable and no longer than 60 seconds.";
  if (seconds.reduce((total, value) => total + value, 0) > 180)
    return "Keep the complete review within three minutes.";
  return "";
}
