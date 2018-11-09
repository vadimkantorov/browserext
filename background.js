chrome.browserAction.onClicked.addListener(function(activeTab)
{
	chrome.storage.sync.get({zrxiv_github_repo: null}, function(options)
	{
		let url = chrome.runtime.getManifest().homepage_url;
		if(options.zrxiv_github_repo)
		{
			const [match, github_username, github_repo] = new RegExp('github.com/(.+)/([^/]+)', 'g').exec(options.zrxiv_github_repo);
			url = 'https://' + github_username + '.github.io/' + github_repo;
		}
		chrome.tabs.create({ url: url });
	});
});
