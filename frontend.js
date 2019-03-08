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
		this.operation_timeout = options.zrxiv_auto_save_timeout;
		this.github_repo = options.zrxiv_github_repo;
		this.ui = { zrxiv : container, zrxiv_tag_add : container.querySelector('#zrxiv_tag_add'), zrxiv_tag : container.querySelector('#zrxiv_tag'), zrxiv_tags : container.querySelector('#zrxiv_tags'), zrxiv_toggle : container.querySelector('#zrxiv_toggle'), zrxiv_hide_show : container.querySelector('#zrxiv_hide_show'), zrxiv_hide_show_status : container.querySelector('#zrxiv_hide_show>span'), zrxiv_checkbox : container.querySelector('#zrxiv_checkbox'), zrxiv_options_missing : container.querySelector('#zrxiv_options_missing'), zrxiv_toggle_status : container.querySelector('#zrxiv_toggle>span'), zrxiv_checkboxes : () => container.querySelectorAll('.zrxiv_checkbox'), zrxiv_checkboxes_labels : () => Array.from(container.querySelectorAll('.zrxiv_checkbox_label')), zrxiv_doc_header : document.querySelector('#zrxiv_doc_header'), zrxiv_deleted_docs : document.querySelector('#zrxiv_deleted_docs') };
	}

	bind()
	{
		const self = this;
		this.ui.zrxiv_tag_add.addEventListener('click', async function()
		{
			const tag = self.ui.zrxiv_tag.value;
			self.operation_status('creating tag', true);
			try
			{
				await self.backend.add_tag(tag);
			}
			catch(exception)
			{
				self.document_action('zrxiv_error', exception);
				return;
			}
			self.operation_status(null);
			self.ui.zrxiv_tags.appendChild(self.render_tag(tag, true));
			self.ui.zrxiv_tag.value = '';
			self.ui.zrxiv_tags.lastChild.firstChild.click();
		});
		self.ui.zrxiv_toggle.addEventListener('click', function() { self.document_action(self.ui.zrxiv_toggle_status.className); } );
		self.ui.zrxiv_tag.addEventListener('keyup', function(event) { if (event.keyCode == 13) self.ui.zrxiv_tag_add.click(); });
		self.ui.zrxiv_toggle_status.dataset.zrxiv_operation_timeout = self.operation_timeout.toString();
		self.ui.zrxiv_hide_show.addEventListener('click', function() {
			if(self.ui.zrxiv_hide_show_status.className == 'zrxiv_hide_show_hide')
			{
				self.ui.zrxiv_hide_show_status.className = 'zrxiv_hide_show_show';
				self.ui.zrxiv.classList.remove('zrxiv_show');
				self.ui.zrxiv_tags.classList.add('zrxiv_hide_show_hidden');
				self.ui.zrxiv_tag_add.classList.add('zrxiv_hide_show_hidden');
				self.ui.zrxiv_tag.classList.add('zrxiv_hide_show_hidden');
			}
			else
			{
				self.ui.zrxiv_hide_show_status.className = 'zrxiv_hide_show_hide';
				self.ui.zrxiv.classList.add('zrxiv_show');
				self.ui.zrxiv_tags.classList.remove('zrxiv_hide_show_hidden');
				self.ui.zrxiv_tag_add.classList.remove('zrxiv_hide_show_hidden');
				self.ui.zrxiv_tag.classList.remove('zrxiv_hide_show_hidden');
			}
		});
	}

	render_tag(tag, checked)
	{
		const self = this;
		let label = document.importNode(self.ui.zrxiv_checkbox.content, true).firstChild;
		let checkbox = label.firstChild, span = label.lastChild;
		span.textContent = tag;
		checkbox.value = tag;
		checkbox.checked = checked;
		checkbox.addEventListener('click', async () => {
			self.operation_status('toggling tag ' + this.value, this.backend.sha != null);
			try
			{
				await self.backend.toggle_tag(this.value, this.checked);
			}
			catch(exception)
			{
				self.document_action('zrxiv_error', exception);
				return;
			}
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
			this.ui.zrxiv_checkboxes().forEach(checkbox => {checkbox.checked = false;});
	}

	async document_action(action, arg)
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
				this.operation_status('saving', true);
				await this.backend.add_doc();
				this.render_tags(true);
				await this.backend.auto_save(true);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
				this.operation_status(null);
				break;

			case 'zrxiv_delete':
				this.operation_status('deleting', true);
				await this.backend.del_doc();
				this.render_tags(false);
				await this.backend.auto_save(false);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
				this.operation_status(null);
				break;

			case 'zrxiv_saved':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
				this.operation_status(null);
				break;

			case 'zrxiv_error':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_refresh';
				this.operation_status(arg.message, 'error')
				break;

			case 'zrxiv_refresh':
				window.location.reload(true);
				break;

			case 'zrxiv':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete_selected';
				break;

			case 'zrxiv_import':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_import_selected';
				break;

			case 'zrxiv_delete_selected':
				const docs = this.ui.zrxiv_doc_header.dataset.selected.split(' ');

				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = (0).toString();
				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_count = docs.length.toString();
				this.ui.zrxiv_toggle_status.dataset.abort = false.toString();
				this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_delete';
				await delay(this.operation_timeout);

				for(let i = 1; i <= docs.length && this.ui.zrxiv_toggle_status.dataset.abort == false.toString(); i++)
				{
					this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = i.toString();
					this.ui.zrxiv_toggle_status.className = 'zrxiv_deleting';
					this.operation_status('deleting', true);
					await delay(this.operation_timeout);
					await this.backend.init_doc(docs[i - 1]);
					await this.backend.del_doc();
					await this.backend.auto_save(false);
					this.operation_status(null);
					this.backend.doc = null;
					this.ui.zrxiv_deleted_docs.value += ' ' + docs[i - 1];
					this.ui.zrxiv_deleted_docs.dispatchEvent(new Event('change'));
				}
				this.ui.zrxiv_toggle_status.className = (this.ui.zrxiv_toggle_status.dataset.abort != false.toString()) ? 'zrxiv_delete_aborted' : 'zrxiv_delete_ok';
				await delay(this.operation_timeout);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete_selected';
				break;

			case 'zrxiv_deleting':
			case 'zrxiv_prevent_delete':
				this.ui.zrxiv_toggle_status.dataset.abort = true.toString();
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete_aborted';
				break;
		}
			
		this.ui.zrxiv_toggle.hidden = false;
		this.ui.zrxiv_hide_show.hidden = false;
	}

	operation_status(status_text, status)
	{
		this.ui.zrxiv_toggle.title = status_text || 'ready';
		[this.ui.zrxiv_toggle, this.ui.zrxiv_tag_add].concat(this.ui.zrxiv_checkboxes_labels()).forEach(el =>
		{
			el.classList.remove(Array.from(el.classList).find(c => c.startsWith('zrxiv_status_')));
			el.classList.add('zrxiv_status_' + (status == true ? 'working' : (status == null || status == false) ? 'ok' : 'error'));
		});
	}

	async start(zrxiv_page)
	{
		if(!this.backend)
		{
			this.ui.zrxiv_options_missing.hidden = false;
			return;
		}

		try
		{
			if(zrxiv_page)
				var tags = await this.backend.get_tags();
			else
				var [doc, tags] = await Promise.all([this.backend.init_doc(), this.backend.get_tags()]);
		}
		catch(exception)
		{
			this.document_action('zrxiv_error', exception);
			return;
		}

		if(zrxiv_page == null)
		{
			this.render_tags(true, this.backend.doc.tags, (tags.status == 200 ? await tags.json() : []).map(x => x.name.split('.').slice(0, -1).join('.')));
			if(this.backend.sha == null)
			{
				if(!this.operation_timeout || await this.backend.auto_save() || this.backend.is_anonymous_submission())
					await this.document_action('zrxiv_prevent_auto_save');
				else
				{
					await this.document_action('zrxiv_auto_save');
					await delay(this.operation_timeout);
					if(this.ui.zrxiv_toggle_status.className == 'zrxiv_prevent_auto_save')
						await this.document_action('zrxiv_save');
				}
			}
			else
				await this.document_action('zrxiv_saved');
		}
		else 
			this.document_action(zrxiv_page);

	}
}

(async () => {
	let container = document.createRange().createContextualFragment(await (await fetch(browser.extension.getURL('frontend.html'))).text()).querySelector('div');
	let frontend = new ZrxivFrontend(container, await browser.storage.sync.get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}), window.location.href);
	const zrxiv_page_url = frontend.github_repo.replace('http://', '').replace('https://', '').replace('github.com/', '').replace('/', '.github.io/');
	const type = window.location.hostname.endsWith('.github.io') ? (window.location.href.includes(zrxiv_page_url) ? (window.location.href.includes('/import') ? 'zrxiv_import' : 'zrxiv') : 'zrxiv_unknown') : null;
	if(type != 'zrxiv_unknown')
	{
		const target = document.getElementById('container') || document.body;
		target.insertBefore(container, target.firstChild);
		frontend.bind();
		await frontend.start(type);
	}
})();
