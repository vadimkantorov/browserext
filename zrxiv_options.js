function zrxiv_restore_options()
{
	chrome.storage.sync.get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout : 5}, function(options)
	{
		document.getElementById('zrxiv_github_repo').value = options.zrxiv_github_repo;
		document.getElementById('zrxiv_github_token').value = options.zrxiv_github_token;
		document.getElementById('zrxiv_auto_save_timeout').value = (options.zrxiv_auto_save_timeout || '').toString();
	});
}

function zrxiv_save_options()
{
	chrome.storage.sync.set({
		zrxiv_github_repo: document.getElementById('zrxiv_github_repo').value,
		zrxiv_github_token : document.getElementById('zrxiv_github_token').value,
		zrxiv_auto_save_timeout : parseInt(document.getElementById('zrxiv_auto_save_timeout').value) || null
	}, function() {});
}

document.addEventListener('DOMContentLoaded', zrxiv_restore_options);
document.getElementById('zrxiv_save_options').addEventListener('click', zrxiv_save_options);
