const is_chrome = typeof(chrome) != 'undefined' && typeof(browser) == 'undefined';
const is_edge = typeof(browser) !== 'undefined' && browser.extension && browser.extension.getURL('/').startsWith('ms-browser-extension://');
	
if(is_chrome)
	browser = chrome;

if(is_chrome || is_edge)
{
	const storage_sync_get = browser.storage.sync.get, storage_sync_set = browser.storage.sync.set;
	Object.defineProperty(browser.storage.sync, 'get', {value: keys => new Promise(resolve => storage_sync_get(keys, resolve)), writable: false});
	Object.defineProperty(browser.storage.sync, 'set', {value: keys => new Promise(resolve => storage_sync_set(keys, resolve)), writable: false});
}
