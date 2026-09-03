export default defineBackground(() => {
  console.log('PassVault background ready');
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('PassVault installed, reason:', details.reason);
  });
});
