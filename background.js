browser.browserAction.onClicked.addListener(async () =>
{
	const options = await browser.storage.sync.get({zrxiv_github_repo: null});
	let url = browser.runtime.getManifest().homepage_url;
	if(options.zrxiv_github_repo)
	{
		const [match, github_username, github_repo] = new RegExp('github.com/(.+)/([^/]+)', 'g').exec(options.zrxiv_github_repo);
		url = 'https://' + github_username + '.github.io/' + github_repo;
	}
	browser.tabs.create({ url: url });
});
