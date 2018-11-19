if(chrome && typeof(browser) == 'undefined')
{
	browser = chrome;
	let chrome_storage_sync_get = chrome.storage.sync.get;
	browser.storage.sync.get = keys => new Promise(resolve => chrome_storage_sync_get(keys, resolve));
}
