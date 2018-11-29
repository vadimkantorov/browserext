function delay(seconds)
{
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function base64_encode_utf8(str)
{
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {return String.fromCharCode(parseInt(p1, 16)) }));
}

class ZrxivGithubBackend
{
	constructor(github_username, github_repo, github_token, href)
	{
		this.api = 'https://api.github.com/repos/' + github_username + '/' + github_repo;
		this.auth_token = github_username + ':' + github_token;
		this.doc = null;
		this.sha = null;
		this.retry_delay_seconds = 2;
	}

	github_api_request(relative_url, method, body)
	{
		return fetch(this.api + relative_url, Object.assign({method : method || 'get', headers : Object.assign({Authorization : 'Basic ' + btoa(this.auth_token)}, body != null ? {'Content-Type' : 'application/json'} : {})}, body != null ? {body : JSON.stringify(body)} : {}));
	}

	async parse_arxiv_document(href)
	{
		const xml = await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
		const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
		const [match, category, id] = new RegExp('.+arxiv.org/abs/(.+/)?([^v]+)', 'g').exec(entry.querySelector('id').innerText);
		const url = 'https://arxiv.org/abs/' + (category ? category + '/' + id : id)
		return {
			title : entry.querySelector('title').innerText, 
			author : Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText),
			abstract : entry.querySelector('summary').innerText,
			id : 'arxiv.' + (category ? category + '_' + id : id),
			url : url,
			pdf : url.replace('arxiv.org/abs/', 'arxiv.org/pdf/'),
			source : 'arxiv.org'
		};
	}

	async init_doc()
	{
		this.doc = await this.parse_arxiv_document(window.location.href);
		this.doc.date = Math.floor(new Date().getTime() / 1000);
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
		return this.github_api_request('/contents/_data/documents/' + this.doc.id + '.json', 'put', Object.assign({message : message + this.doc.id, content : base64_encode_utf8(JSON.stringify(this.doc, null, 2))}, sha ? {sha : sha} : {}))
		.then(async resp => { if(resp.status == 200 || resp.status == 201)	this.sha = (await resp.json()).content.sha;	})
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
		return this.github_api_request('/contents/_data/tags/' + tag + '.json', 'put', {message : 'Create tag ' + tag, content : base64_encode_utf8('{}') })
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
		if(this.sha != null)
			return this.put_doc('Change tag of ', this.sha);
	}

	async auto_save(action)
	{
		let prevent_auto_save = (await browser.storage.sync.get({prevent_auto_save : {}})).prevent_auto_save;
		if(action == null)
			return prevent_auto_save[this.doc.id];
		else if(action == false)
		{
			prevent_auto_save[this.doc.id] = true;
			browser.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
		else if(action == true && prevent_auto_save.indexOf(this.doc.id) >= 0)
		{
			delete prevent_auto_save[this.doc.id];
			browser.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
	}
}

class ZrxivFrontend
{
	constructor(container, options, href)
	{
		this.container = container;
		if(options.zrxiv_github_repo != null && options.zrxiv_github_token != null)
		{
			const [match, github_username, github_repo] = new RegExp('github.com/(.+)/([^/]+)', 'g').exec(options.zrxiv_github_repo);
			this.backend = new ZrxivGithubBackend(github_username, github_repo, options.zrxiv_github_token, href);
		}
		else
			this.backend = null;
		this.auto_save_timeout = options.zrxiv_auto_save_timeout;
		this.ui = { zrxiv_tag_add : container.querySelector('#zrxiv_tag_add'), zrxiv_tag : container.querySelector('#zrxiv_tag'), zrxiv_tags : container.querySelector('#zrxiv_tags'), zrxiv_toggle : container.querySelector('#zrxiv_toggle'), zrxiv_checkbox : container.querySelector('#zrxiv_checkbox'), zrxiv_options_missing : container.querySelector('#zrxiv_options_missing'), zrxiv_toggle_status : container.querySelector('#zrxiv_toggle>span')};
	}

	render_tag(tag, checked)
	{
		const self = this;
		let label = document.importNode(self.ui.zrxiv_checkbox.content, true).firstChild;
		let checkbox = label.firstChild, span = label.lastChild;
		span.textContent = tag;
		checkbox.value = tag;
		checkbox.checked = checked;
		checkbox.addEventListener('click', function() { self.backend.toggle_tag(this.value, this.checked); });
		return label;
	}

	render_tags(show, tags_on, tags)
	{
		if(tags_on != null)
		{
			if(tags.length == 0)
				this.ui.zrxiv_tags.innerHTML = '(no tags exist yet)';
			else
			{
				this.ui.zrxiv_tags.innerHTML = '';
				tags.forEach(tag => this.ui.zrxiv_tags.appendChild(this.render_tag(tag, tags_on.indexOf(tag) >= 0)));
			}
		}

		if(show)
		{
			[this.ui.zrxiv_tag, this.ui.zrxiv_tag_add, this.ui.zrxiv_tags].forEach(elem => {elem.style.display = '';});
			this.ui.zrxiv_tags.style.display = 'inline';
		}
		else
		{
			[this.ui.zrxiv_tag, this.ui.zrxiv_tag_add, this.ui.zrxiv_tags].forEach(elem => {elem.style.display = 'none';});
			this.container.querySelectorAll('.zrxiv_checkbox').forEach(checkbox => {checkbox.checked = false;});
		}
	}

	render_status(good, status_text)
	{
		
	}

	document_action(action)
	{
		if(action == 'zrxiv_auto_save')
			this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_auto_save'; // ' in' + this.auto_save_timeout + ' seconds';
		else if(action == 'zrxiv_prevent_auto_save')
		{
			this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
			this.backend.auto_save(false);
		}
		else if(action == 'zrxiv_save')
		{
			this.backend.add_doc();
			this.render_tags(true);
			this.backend.auto_save(true);
			this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
		}
		else if(action == 'zrxiv_delete')
		{
			this.backend.del_doc();
			this.render_tags(false);
			this.backend.auto_save(false);
			this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
		}
		else if(action == 'zrxiv_saved')
			this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
			
		this.ui.zrxiv_toggle.style.display = '';
	}

	bind()
	{
		const self = this;
		this.ui.zrxiv_tag_add.addEventListener('click', async function()
		{
			const tag = self.ui.zrxiv_tag.value;
			await self.backend.add_tag(tag);
			await self.backend.toggle_tag(tag, true);
			self.ui.zrxiv_tags.appendChild(self.render_tag(tag, true));
			self.ui.zrxiv_tag.value = '';
		});
		self.ui.zrxiv_toggle.addEventListener('click', function() { self.document_action(self.ui.zrxiv_toggle_status.className); } );
		self.ui.zrxiv_tag.addEventListener('keyup', function(event) { if (event.keyCode == 13) self.ui.zrxiv_tag_add.click(); });
	}

	async start()
	{
		if(!this.backend)
		{
			this.ui.zrxiv_options_missing.style.display = ''; 
			return;
		}

		const [doc, tags] = await Promise.all([this.backend.init_doc(), this.backend.get_tags()]);
		this.render_tags(true, this.backend.doc.tags, (tags.status == 200 ? await tags.json() : []).map(x => x.name.split('.').slice(0, -1).join('.')));
		if(this.backend.sha == null)
		{
			if(!this.auto_save_timeout || await this.backend.auto_save())
				this.document_action('zrxiv_prevent_auto_save');
			else
			{
				this.document_action('zrxiv_auto_save');
				await delay(this.auto_save_timeout);
				this.document_action('zrxiv_save');
			}
		}
		else
			this.document_action('zrxiv_saved');
	}
}

(async () => {
	let container = document.createElement('div');
	container.innerHTML = await (await fetch(browser.extension.getURL('header.html'))).text();
	document.body.insertBefore(container, document.body.firstChild);
	let frontend = new ZrxivFrontend(container, await browser.storage.sync.get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}), window.location.href);
	frontend.bind();
	await frontend.start();
})();
