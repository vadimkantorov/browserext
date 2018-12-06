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
		this.href = href;
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

	async init_doc()
	{
		this.doc = await parse_doc(document, this.href, Math.floor(new Date().getTime() / 1000));
		const resp = await this.github_api_request('/contents/data/documents/' + this.doc.id + '.json');
		if(resp.status == 200)
		{
			const {content, sha} = await resp.json();
			this.doc = JSON.parse(atob(content));
			this.sha = sha;
		}
	}

	get_tags()
	{
		return this.github_api_request('/contents/data/tags');
	}

	async put_doc(message, sha, retry)
	{
		const resp = await this.github_api_request('/contents/data/documents/' + this.doc.id + '.json', 'put', Object.assign({message : message + this.doc.id, content : base64_encode_utf8(JSON.stringify(this.doc, null, 2))}, sha ? {sha : sha} : {}))
		if(resp.status == 200 || resp.status == 201)
			this.sha = (await resp.json()).content.sha;
		else if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			await this.put_doc(message, sha ? ((await this.init_doc()) || this.sha) : null, false);
		}
	}

	async del_doc(retry)
	{
		const resp = await this.github_api_request('/contents/data/documents/' + this.doc.id + '.json', 'delete', {message : 'Delete ' + this.doc.id, sha : this.sha})
		if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			await this.init_doc();
			return this.del_doc(false);
		}
	}

	async add_tag(tag, retry)
	{
		const resp = this.github_api_request('/contents/data/tags/' + tag + '.md', 'put', {message : 'Create tag ' + tag, content : '' })
		if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			return this.add_tag(tag, false);
		}
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
			await browser.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
		else if(action == true && prevent_auto_save.indexOf(this.doc.id) >= 0)
		{
			delete prevent_auto_save[this.doc.id];
			await browser.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
	}
}

class ZrxivFrontend
{
	constructor(container, options, href)
	{
		if(options.zrxiv_github_repo != null && options.zrxiv_github_token != null)
		{
			const [match, github_username, github_repo] = new RegExp('github.com/(.+)/([^/]+)', 'g').exec(options.zrxiv_github_repo);
			this.backend = new ZrxivGithubBackend(github_username, github_repo, options.zrxiv_github_token, href);
		}
		else
			this.backend = null;
		this.auto_save_timeout = options.zrxiv_auto_save_timeout;
		this.ui = { zrxiv_tag_add : container.querySelector('#zrxiv_tag_add'), zrxiv_tag : container.querySelector('#zrxiv_tag'), zrxiv_tags : container.querySelector('#zrxiv_tags'), zrxiv_toggle : container.querySelector('#zrxiv_toggle'), zrxiv_checkbox : container.querySelector('#zrxiv_checkbox'), zrxiv_options_missing : container.querySelector('#zrxiv_options_missing'), zrxiv_toggle_status : container.querySelector('#zrxiv_toggle>span'), zrxiv_checkboxes : () => container.querySelectorAll('.zrxiv_checkbox') };
	}

	bind()
	{
		const self = this;
		this.ui.zrxiv_tag_add.addEventListener('click', async function()
		{
			const tag = self.ui.zrxiv_tag.value;
			self.operation_status('creating tag');
			await self.backend.add_tag(tag);
			self.ui.zrxiv_tags.appendChild(self.render_tag(tag, true));
			self.ui.zrxiv_tag.value = '';
			self.ui.zrxiv_tags.lastChild.firstChild.click();
		});
		self.ui.zrxiv_toggle.addEventListener('click', function() { self.document_action(self.ui.zrxiv_toggle_status.className); } );
		self.ui.zrxiv_tag.addEventListener('keyup', function(event) { if (event.keyCode == 13) self.ui.zrxiv_tag_add.click(); });
		self.ui.zrxiv_toggle_status.dataset.zrxiv_auto_save_timeout = self.auto_save_timeout.toString();
	}

	render_tag(tag, checked)
	{
		const self = this;
		let label = document.importNode(self.ui.zrxiv_checkbox.content, true).firstChild;
		let checkbox = label.firstChild, span = label.lastChild;
		span.textContent = tag;
		checkbox.value = tag;
		checkbox.checked = checked;
		checkbox.addEventListener('click', function() {
			self.operation_status('toggling tag ' + this.value);
			self.backend.toggle_tag(this.value, this.checked);
			self.operation_status(null);
		});
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
			[this.ui.zrxiv_tag, this.ui.zrxiv_tag_add, this.ui.zrxiv_tags].forEach(elem => {elem.hidden = false;});
			this.ui.zrxiv_tags.style.display = 'inline';
		}
		else
		{
			[this.ui.zrxiv_tag, this.ui.zrxiv_tag_add, this.ui.zrxiv_tags].forEach(elem => {elem.hidden = true;});
			this.ui.zrxiv_checkboxes().forEach(checkbox => {checkbox.checked = false;});
		}
	}

	async document_action(action)
	{
		switch(action)
		{
			case 'zrxiv_auto_save':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_auto_save';
				break;

			case 'zrxiv_prevent_auto_save':
				await this.backend.auto_save(false);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
				break;

			case 'zrxiv_save':
				this.operation_status('saving');
				await this.backend.add_doc();
				this.render_tags(true);
				await this.backend.auto_save(true);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
				this.operation_status(null);
				break;

			case 'zrxiv_delete':
				this.operation_status('deleting');
				await this.backend.del_doc();
				this.render_tags(false);
				await this.backend.auto_save(false);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
				this.operation_status(null);
				break;

			case 'zrxiv_saved':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
				break;
		}
			
		this.ui.zrxiv_toggle.hidden = false;
	}

	operation_status(status_text)
	{
		this.ui.zrxiv_toggle.title = status_text || 'ready';
	}

	async start()
	{
		if(!this.backend)
		{
			this.ui.zrxiv_options_missing.hidden = false;
			return;
		}

		const [doc, tags] = await Promise.all([this.backend.init_doc(), this.backend.get_tags()]);
		this.render_tags(true, this.backend.doc.tags, (tags.status == 200 ? await tags.json() : []).map(x => x.name.split('.').slice(0, -1).join('.')));
		if(this.backend.sha == null)
		{
			if(!this.auto_save_timeout || await this.backend.auto_save())
				await this.document_action('zrxiv_prevent_auto_save');
			else
			{
				await this.document_action('zrxiv_auto_save');
				await delay(this.auto_save_timeout);
				await this.document_action('zrxiv_save');
			}
		}
		else
			await this.document_action('zrxiv_saved');
	}
}

(async () => {
	let container = document.createRange().createContextualFragment(await (await fetch(browser.extension.getURL('header.html'))).text()).querySelector('div');
	document.body.insertBefore(container, document.body.firstChild);
	let frontend = new ZrxivFrontend(container, await browser.storage.sync.get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}), window.location.href);
	frontend.bind();
	await frontend.start();
})();
