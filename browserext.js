if(typeof(chrome) != 'undefined' && typeof(browser) == 'undefined')
{
	browser = chrome;
	browser.storage.sync.get = (keys, chrome_storage_sync_get = chrome.storage.sync.get) => new Promise(resolve => chrome_storage_sync_get(keys, resolve));
}
