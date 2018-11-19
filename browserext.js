const is_chrome = typeof(chrome) != 'undefined' && typeof(browser) == 'undefined';
const is_edge = typeof(browser) !== "undefined" && browser.extension && browser.extension.getURL("/").startsWith("ms-browser-extension://");
	
if(is_chrome)
{
	browser = chrome;
	const storage_sync_get = chrome.storage.sync.get;
	Object.defineProperty(browser.storage.sync, 'get', {value: keys => new Promise(resolve => storage_sync_get(keys, resolve)), writable: false});
}
else if(is_edge)
{
	const storage_sync_get = browser.storage.sync.get;
	Object.defineProperty(browser.storage.sync, 'get', {value: keys => new Promise(resolve => storage_sync_get(keys, resolve)), writable: false});
}
