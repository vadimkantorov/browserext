chrome.browserAction.onClicked.addListener(function(activeTab)
{
	chrome.storage.sync.get({zrxiv_github_repo: chrome.runtime.getManifest().homepage_url}, function(options)
	{
		const url = options.zrxiv_github_repo.startsWith('http') ? options.zrxiv_github_repo : 'https://' + options.zrxiv_github_repo;
		chrome.tabs.create({ url: url });
	});
});
