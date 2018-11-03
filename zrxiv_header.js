function async_chrome_storage_sync_get(obj)
{
	return new Promise(resolve => chrome.storage.sync.get(obj, resolve));
}

function delay(seconds)
{
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

class ZrxivGithubBackend
{
	constructor(zrxiv_github_repo, zrxiv_github_token, href)
	{
		const [match, username, repo] = new RegExp('([^/]+)\.github.io/(.+)', 'g').exec(zrxiv_github_repo);
		this.api = 'https://api.github.com/repos/' + username + '/' + repo;
		this.auth_token = username + ':' + zrxiv_github_token;
		this.doc = null;
		this.sha = null;
		this.retry_delay_seconds = 2;
	}

	github_api_request(relative_url, method, body)
	{
		return fetch(this.api + relative_url, Object.assign({method : method || 'get', headers : Object.assign({Authorization : 'Basic ' + btoa(this.auth_token)}, body != null ? {'Content-Type' : 'application/json'} : {})}, body != null ? {body : JSON.stringify(body)} : {}));
	}

	async parse_arxiv_document()
	{
		const xml = await (await fetch(window.location.href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
		const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
		return {
			title : entry.querySelector('title').innerText, 
			author : Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText),
			abstract : entry.querySelector('summary').innerText,
			id : new RegExp('abs/(\\d+\.\\d+)', 'g').exec(entry.querySelector('id').innerText)[1],
		};
	}

	async init_doc()
	{
		this.doc = await this.parse_arxiv_document();
		this.doc.date = Math.floor(new Date().getTime() / 1000);
		this.doc.url = window.location.href;
		this.doc.tags = [];
		const resp = await this.github_api_request('/contents/_data/documents/' + this.doc.id + '.json');
		if(resp.status == 200)
		{
			const {content, sha} = await resp.json();
			this.doc = JSON.parse(atob(content));
			this.sha = sha;
		}
	}

	get_tags()
	{
		return this.github_api_request('/contents/_data/tags');
	}

	put_doc(message, sha, retry)
	{
		return this.github_api_request('/contents/_data/documents/' + this.doc.id + '.json', 'put', Object.assign({message : message + this.doc.id, content : btoa(JSON.stringify(this.doc, null, 2))}, sha ? {sha : sha} : {}))
		.catch(async resp => 
		{
			if(resp.status == 409 && retry != false)
			{
				await delay(this.retry_delay_seconds);
				return this.put_doc(message, sha ? ((await this.init_doc()) || this.sha) : null, false);
			}
		})
	}

	async del_doc(retry)
	{
		return this.github_api_request('/contents/_data/documents/' + this.doc.id + '.json', 'delete', {message : 'Delete ' + this.doc.id, sha : this.sha})
		.catch(async resp => 
		{
			if(resp.status == 409 && retry != false)
			{
				await delay(this.retry_delay_seconds);
				await this.init_doc();
				return this.del_doc(false);
			}
		})
	}

	add_tag(tag, retry)
	{
		return this.github_api_request('/contents/_data/tags/' + tag + '.json', 'put', {message : 'Create tag ' + tag, content : '{}' })
		.catch(async resp => 
		{
			if(resp.status == 409 && retry != false)
			{
				await delay(this.retry_delay_seconds);
				return this.add_tag(tag, false);
			}
		});
	}

	add_doc()
	{
		return this.put_doc('Add ');
	}

	async toggle_tag(tag, checked)
	{
		const idx_old = this.doc.tags.indexOf(tag);
		if(checked && idx_old < 0)
			this.doc.tags.push(tag);
		else if(!checked && idx_old >= 0)
			this.doc.tags.splice(idx_old, 1);
		return this.put_doc('Change tag of ', this.sha);
	}

	async auto_save(action)
	{
		let prevent_auto_save = (await async_chrome_storage_sync_get({prevent_auto_save : {}})).prevent_auto_save;
		if(action == null)
			return prevent_auto_save[this.doc.id];
		else if(action == false)
		{
			prevent_auto_save[this.doc.id] = true;
			chrome.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
		else if(action == true && prevent_auto_save.indexOf(this.doc.id) >= 0)
		{
			delete prevent_auto_save[this.doc.id];
			chrome.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
	}
}

function zrxiv_make_checkbox(zrxiv_api, tag, checked)
{
	let label = document.importNode(document.getElementById('zrxiv_checkbox').content, true).firstChild;
	let checkbox = label.firstChild;
	label.appendChild(document.createTextNode(tag));
	checkbox.value = tag;
	checkbox.checked = checked;
	checkbox.addEventListener('click', function(event) { if(this.style.display != 'none') zrxiv_api.toggle_tag(this.value, this.checked); });
	return label;
}

function zrxiv_toggle(zrxiv_api, action, zrxiv_auto_save_timeout)
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
			zrxiv_api.add_doc();
			zrxiv_tags_render(zrxiv_api, true);
			zrxiv_api.auto_save(true);
		}
		zrxiv_toggle_button.dataset.action = 'delete';
		zrxiv_toggle_button.innerText = 'Delete';
	}
	else if(action == 'delete')
	{
		zrxiv_api.del_doc();
		zrxiv_tags_render(zrxiv_api, false);
		zrxiv_api.auto_save(false);
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
	}
	zrxiv_toggle_button.style.display = '';
}

function zrxiv_tags_render(zrxiv_api, show, tags_on, tags)
{
	let zrxiv_tags = document.getElementById('zrxiv_tags');
	if(tags_on != null)
	{
		if(tags.length == 0)
			zrxiv_tags.innerHTML = '(no tags exist yet)';
		else
		{
			zrxiv_tags.innerHTML = '';
			tags.forEach(tag => zrxiv_tags.appendChild(zrxiv_make_checkbox(zrxiv_api, tag, tags_on.indexOf(tag) >= 0)))
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

async function zrxiv_init(options)
{
	if(options.zrxiv_github_repo == null || options.zrxiv_github_token == null)
	{
		document.getElementById('zrxiv_options').href = chrome.runtime.getURL('zrxiv_options.html');
		document.getElementById('zrxiv_options_missing').style.display = ''; 
		document.getElementById('zrxiv_site').href = chrome.runtime.getManifest().homepage_url;
		return;
	}

	let zrxiv_api = new ZrxivGithubBackend(options.zrxiv_github_repo, options.zrxiv_github_token, window.location.href);
	document.getElementById('zrxiv_site').href = options.zrxiv_github_repo.startsWith('http') ? options.zrxiv_github_repo : 'https://' + options.zrxiv_github_repo;
	document.getElementById('zrxiv_tag_add').addEventListener('click', async function(event)
	{
		const tag = document.getElementById('zrxiv_tag').value;
		await zrxiv_api.add_tag(tag);
		await zrxiv_api.toggle_tag(tag, true);
		document.getElementById('zrxiv_tags').appendChild(zrxiv_make_checkbox(zrxiv_api, tag, true));
		document.getElementById('zrxiv_tag').value = '';
	});
	document.getElementById('zrxiv_toggle').addEventListener('click', function(event) { zrxiv_toggle(zrxiv_api, this.dataset.action); } );
	document.getElementById('zrxiv_tag').addEventListener('keyup', function(event) { if (event.keyCode == 13) document.getElementById('zrxiv_tag_add').click(); });

	let [doc, tags] = await Promise.all([zrxiv_api.init_doc(), zrxiv_api.get_tags()]);
	zrxiv_tags_render(zrxiv_api, zrxiv_api.sha != null, zrxiv_api.doc.tags, (tags.status == 200 ? await tags.json() : []).map(x => x.name.split('.').slice(0, -1).join('.')));
	if(zrxiv_api.sha == null)
	{
		if(!options.zrxiv_auto_save_timeout || await zrxiv_api.auto_save())
			zrxiv_toggle('prevent-auto-save');
		else
		{
			zrxiv_toggle(zrxiv_api, 'auto-save', options.zrxiv_auto_save_timeout);
			await delay(options.zrxiv_auto_save_timeout);
			zrxiv_toggle(zrxiv_api, 'save');
		}
	}
	else
		zrxiv_toggle(zrxiv_api, 'saved');
}

(async () => {
	const html = await (await fetch(chrome.extension.getURL('zrxiv_header.html'))).text();
	let container = document.createElement('div');
	container.innerHTML = html;
	document.body.insertBefore(container, document.body.firstChild);
	zrxiv_init(await async_chrome_storage_sync_get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}));
})();
