chrome.browserAction.onClicked.addListener(function(activeTab)
{
	chrome.storage.sync.get({zrxiv_github_repo: chrome.runtime.getManifest().homepage_url}, function(options)
	{
		chrome.tabs.create({ url: options.zrxiv_github_repo });
	});
});
