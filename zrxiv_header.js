var zrxiv_api = null;

function async_chrome_storage_sync_get(obj)
{
	return new Promise(resolve => chrome.storage.sync.get(obj, resolve));
}

class ZrxivGithubBackend
{
	constructor(api, auth_token, doc_id)
	{
		this.api = api;
		this.auth_token = auth_token;
		this.doc_id = doc_id;
	}

	get_doc()
	{
		return fetch(this.api + '/contents/_data/documents/' + this.doc_id + '.json', 
		{
			headers : {'Authorization' : 'Basic ' + btoa(this.auth_token)}
		});
	}

	get_tags()
	{
		return fetch(this.api + '/contents/_data/tags',
		{
			headers : {'Authorization' : 'Basic ' + btoa(this.auth_token)}
		});
	}

	put_doc(message, doc, sha)
	{
		let body = {message : message + this.doc_id, content : btoa(JSON.stringify(doc, null, 2))};
		if(sha)
			body.sha = sha;
		return fetch(this.api + '/contents/_data/documents/' + this.doc_id + '.json',
		{
			method : 'put',
			headers : 
			{
				'Content-Type' : 'application/json',
				'Authorization' : 'Basic ' + btoa(this.auth_token)
			},
			body : JSON.stringify(body)
		})
	}

	async del_doc()
	{
		let response = await this.get_doc();
		let json = await response.json();
		return fetch(this.api + '/contents/_data/documents/' + this.doc_id + '.json',
		{
			method : 'delete',
			headers : 
			{
				'Content-Type' : 'application/json',
				'Authorization' : 'Basic ' + btoa(this.auth_token)
			},
			body : JSON.stringify({message : 'Delete ' + this.doc_id, sha : json.sha})
		});
	}

	add_tag(tag)
	{
		return fetch(this.api + '/contents/_data/tags/' + tag + '.json',
		{
			method : 'put',
			headers :
			{
				'Content-Type' : 'application/json',
				'Authorization' : 'Basic ' + btoa(this.auth_token)
			},
			body : JSON.stringify({message : 'Create tag ' + tag, content : '' })
		});
	}

	async toggle_tag(tag, checked)
	{
		const json = await (await this.get_doc()).json();
		const doc = JSON.parse(atob(json.content));
		const checked_old = doc.tags.indexOf(tag) != -1;
		if(checked && !checked_old)
			doc.tags.push(tag);
		else if(!checked && checked_old)
			doc.tags = doc.tags.filter(x => x != tag);
		return zrxiv_api.put_doc('Change tag of ', doc, json.sha);
	}

	async auto_save(action)
	{
		let prevent_auto_save = (await async_chrome_storage_sync_get({prevent_auto_save : []})).prevent_auto_save;
		if(action == null)
			return prevent_auto_save.indexOf(this.doc_id) >= 0;
		else if(action == false && prevent_auto_save.indexOf(this.doc_id) < 0)
		{
			prevent_auto_save.push(this.doc_id);
			chrome.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
		else if(action == true && docs.indexOf(this.doc_id) >= 0)
		{
			prevent_auto_save = prevent_auto_save.filter(x => x != this.doc_id);
			chrome.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
	}
}

function zrxiv_make_checkbox(tag, checked)
{
	let checkbox = document.createElement('input');
	checkbox.type = 'checkbox'
	checkbox.className = 'zrxiv_checkbox';
	checkbox.value = tag;
	checkbox.checked = checked;
	checkbox.addEventListener('change', function() { if(this.style.display != 'none') zrxiv_api.toggle_tag(this.value, this.checked); });
	let label = document.createElement('label');
	label.appendChild(checkbox);
	label.appendChild(document.createTextNode(tag));
	return label;
}

function zrxiv_toggle(action, zrxiv_auto_save_timeout)
{
	let zrxiv_toggle_button = document.getElementById('zrxiv_toggle');
	if(action == 'auto-save')
	{
		zrxiv_toggle_button.innerText = 'Prevent auto-save in ' + zrxiv_auto_save_timeout + ' seconds';
		zrxiv_toggle_button.dataset.action = 'prevent-auto-save';
	}
	else if(action == 'prevent-auto-save')
	{
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
		zrxiv_api.auto_save(false);
	}
	else if(action == 'save' || action == 'saved')
	{
		if(action == 'save')
		{
			const doc = {id : zrxiv_api.doc_id, title : document.title, url : window.location.href, date : Math.floor(new Date().getTime() / 1000), tags : [] };
			zrxiv_api.put_doc('Add ', doc);
			zrxiv_tags_render(true);
			zrxiv_api.auto_save(true);
		}
		zrxiv_toggle_button.dataset.action = 'delete';
		zrxiv_toggle_button.innerText = 'Delete';
	}
	else if(action == 'delete')
	{
		zrxiv_document_del();
		zrxiv_tags_render(false);
		zrxiv_api.auto_save(false);
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
	}
	zrxiv_toggle_button.style.display = '';
}

function zrxiv_tags_render(show, tags_on, tags)
{
	let zrxiv_tags = document.getElementById('zrxiv_tags');
	if(tags_on != null)
	{
		if(tags.length == 0)
			zrxiv_tags.innerHTML = '(no tags exist yet)';
		else
		{
			zrxiv_tags.innerHTML = '';
			tags.forEach(tag => zrxiv_tags.appendChild(zrxiv_make_checkbox(tag, tags_on.indexOf(tag) >= 0)))
		}
	}

	if(show)
	{
		document.querySelectorAll('#zrxiv_tags_label, #zrxiv_tag, #zrxiv_tag_add, #zrxiv_tags').forEach(elem => {elem.style.display = '';});
		zrxiv_tags.style.display = 'inline';
	}
	else
	{
		document.querySelectorAll('#zrxiv_tags_label, #zrxiv_tag, #zrxiv_tag_add, #zrxiv_tags').forEach(elem => {elem.style.display = 'none';});
		document.querySelectorAll('.zrxiv_checkbox').forEach(checkbox => {checkbox.checked = false;});
	}
}

async function parse_arxiv_document()
{
	const xml = await (await fetch(window.location.href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
	const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
	const abs = entry.querySelector('summary').innerText;
	const title = entry.querySelector('title').innerText;
	const authors = Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText);
	
	return {
		title : title, 
		url : window.location.href,
		author : authors,
		abstract : abs
	};
}

async function zrxiv_init(options)
{
	if(options.zrxiv_github_repo == null || options.zrxiv_github_token == null)
	{
		document.getElementById('zrxiv_options').href = chrome.runtime.getURL('zrxiv_options.html');
		document.getElementById('zrxiv_options_missing').style.display = ''; 
		document.getElementById('zrxiv_site').href = chrome.runtime.getManifest().homepage_url;
		return;
	}

	const [match, username, repo] = new RegExp('([^/]+)\.github.io/(.+)', 'g').exec(options.zrxiv_github_repo);
	zrxiv_api = new ZrxivGithubBackend('https://api.github.com/repos/' + username + '/' + repo, username + ':' + options.zrxiv_github_token, new RegExp('abs/(\\d+\.\\d+)', 'g').exec(window.location.href)[1]);

	//const parsed_doc = parse_arxiv_document();
	document.getElementById('zrxiv_site').href = options.zrxiv_github_repo.startsWith('http') ? options.zrxiv_github_repo : 'https://' + options.zrxiv_github_repo;
	document.getElementById('zrxiv_tag_add').addEventListener('click', async function(event)
	{
		const tag = document.getElementById('zrxiv_tag').value;
		await zrxiv_api.add_tag(tag);
		await zrxiv_api.toggle_tag(tag, true);
		document.getElementById('zrxiv_tags').appendChild(zrxiv_make_checkbox(tag, true));
		document.getElementById('zrxiv_tag').value = '';
	});
	document.getElementById('zrxiv_toggle').addEventListener('click', function(event) { zrxiv_toggle(this.dataset.action); } );
	document.getElementById('zrxiv_tag').addEventListener('keyup', function(event) { if (event.keyCode == 13) document.getElementById('zrxiv_tag_add').click(); });

	const resps = await Promise.all([zrxiv_api.get_doc(), zrxiv_api.get_tags()]);
	const [doc, tags] = await Promise.all([resps[0].status == 200 ? await resps[0].json() : null, resps[1].status == 200 ? await resps[1].json() : []]);
	zrxiv_tags_render(doc != null, doc != null ? JSON.parse(atob(doc.content)).tags : [], tags.map(x => x.name.split('.').slice(0, -1).join('.')));
	if(doc != null)
		zrxiv_toggle('saved');
	else
	{
		if(!options.zrxiv_auto_save_timeout || await zrxiv_api.auto_save())
			zrxiv_toggle('prevent-auto-save');
		else
		{
			zrxiv_toggle('auto-save', zrxiv_auto_save_timeout);
			await new Promise(resolve => setTimeout(resolve, options.zrxiv_auto_save_timeout * 1000));
			zrxiv_toggle('save');
		}
	}
}

(async () => {
	const html = await (await fetch(chrome.extension.getURL('zrxiv_header.html'))).text();
	const container = document.createElement('div');
	container.innerHTML = html;
	document.body.insertBefore(container, document.body.firstChild);
	zrxiv_init(await async_chrome_storage_sync_get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}));
})();
