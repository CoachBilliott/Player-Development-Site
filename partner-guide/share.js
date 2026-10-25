/* global document, navigator */
const shareButton = document.getElementById("copy-link");
shareButton.addEventListener("click", async () => {
  const status = document.getElementById("share-status");
  const link = document.getElementById("guide-link");
  shareButton.disabled = true;
  try {
    await navigator.clipboard.writeText(link.value);
    status.textContent = "Link copied. You can send it to your partner.";
  } catch {
    document.getElementById("manual-share").hidden = false;
    link.focus();
    link.select();
    status.textContent = "Select and copy the guide link below.";
  } finally {
    shareButton.disabled = false;
  }
});
