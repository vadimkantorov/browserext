function read_deleted_docs()
{
	let docs = document.cookie.split('deleted_docs=');
	docs = docs.length >= 2 ? docs[1].split(';')[0].trim() : '';
	docs = docs.length > 0 ? docs.split(',') : [];
	return docs.filter(doc => doc).map(doc => doc.trim());
}

function mark_deleted_docs()
{
	const docs = read_deleted_docs();
	if(docs.length > 0)
		document.querySelectorAll(docs.map(doc => `li[data-id="${doc}"]`).join(',')).forEach(li => {
			li.title = 'Document is being deleted';
			li.classList.add('doc-deleted');
			const checkbox = li.querySelector('input[type=checkbox]');
			checkbox.checked = false;
			checkbox.disabled = true;
		});
}

function update_deleted_docs(docs)
{
	const expires_in_minutes = 15;
	var date = new Date();
	date.setTime(date.getTime() + expires_in_minutes * 60 * 1000);
	const deleted_docs = Array.from(new Set(read_deleted_docs().concat(docs.trim().split(' '))));
	document.cookie = `deleted_docs=${deleted_docs.join(',')}; expires=${date.toGMTString()}`;
	mark_deleted_docs();
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
		this.operation_timeout = options.zrxiv_auto_save_timeout;
		this.github_repo = options.zrxiv_github_repo;
		this.home_page = document.baseURI;
		this.ui =
		{
			zrxiv : container, 
			zrxiv_tag_add : container.querySelector('#zrxiv_tag_add'), 
			zrxiv_tag : container.querySelector('#zrxiv_tag'), 
			zrxiv_tags : container.querySelector('#zrxiv_tags'), 
			zrxiv_toggle : container.querySelector('#zrxiv_toggle'), 
			zrxiv_checkbox : container.querySelector('#zrxiv_checkbox'), 
			zrxiv_options_missing : container.querySelector('#zrxiv_options_missing'), 
			zrxiv_toggle_status : container.querySelector('#zrxiv_toggle>span'), 
			zrxiv_checkboxes : () => container.querySelectorAll('.zrxiv_checkbox'), 
			zrxiv_checkboxes_labels : () => Array.from(container.querySelectorAll('.zrxiv_checkbox_label')), 

			zrxiv_delete_tag_button : container.querySelector('#zrxiv_delete_tag_button'), 
			zrxiv_delete_tag_button_status : container.querySelector('#zrxiv_delete_tag_button>span'), 
			zrxiv_delete_from_tag_button : container.querySelector('#zrxiv_delete_from_tag_button'), 
			zrxiv_delete_from_tag_button_status : container.querySelector('#zrxiv_delete_from_tag_button>span'),

			zrxiv_hide_show : container.querySelector('#zrxiv_hide_show'), 
			zrxiv_hide_show_status : container.querySelector('#zrxiv_hide_show>span'), 
			zrxiv_hide_show_elements : Array.from(container.querySelectorAll('.zrxiv_hide_show')),

			zrxiv_status_elements : Array.from(container.querySelectorAll('.zrxiv_status')), 
 
			zrxiv_deleted_docs : container.querySelector('#zrxiv_deleted_docs'), 
			zrxiv_doc_header : document.querySelector('#zrxiv_doc_header'), 
			zrxiv_bibtex_selected : document.querySelector('#zrxiv_bibtex_selected')
		};
	}

	bind(page_type)
	{
		const self = this;
		self.ui.zrxiv_tag_add.onclick = async () => self.document_action('zrxiv_add_tag', self.ui.zrxiv_tag.value);
		self.ui.zrxiv_delete_tag_button.onclick = async e => self.document_action(self.ui.zrxiv_delete_tag_button_status.className, e.target);
		self.ui.zrxiv_delete_from_tag_button.onclick = async e => self.document_action(self.ui.zrxiv_delete_from_tag_button_status.className, e.target);
		self.ui.zrxiv_toggle.onclick = async e => self.document_action(self.ui.zrxiv_toggle_status.className, e.target);
		self.ui.zrxiv_tag.onkeyup = e => e.keyCode != 13 || self.ui.zrxiv_tag_add.click();
		self.ui.zrxiv_toggle_status.dataset.zrxiv_operation_timeout = self.ui.zrxiv_delete_from_tag_button_status.dataset.zrxiv_operation_timeout = self.operation_timeout.toString();
		self.ui.zrxiv_deleted_docs.onchange = () => update_deleted_docs(self.ui.zrxiv_deleted_docs.value);
		self.ui.zrxiv_hide_show.onclick = () => 
		{
			if(self.ui.zrxiv_hide_show_status.className == 'zrxiv_hide_show_hide')
			{
				self.ui.zrxiv_hide_show_status.className = 'zrxiv_hide_show_show';
				self.ui.zrxiv.classList.remove('zrxiv_show');
				self.ui.zrxiv_hide_show_elements.forEach(elem => elem.classList.add('zrxiv_hide_show_hidden'));
			}
			else
			{
				self.ui.zrxiv_hide_show_status.className = 'zrxiv_hide_show_hide';
				self.ui.zrxiv.classList.add('zrxiv_show');
				self.ui.zrxiv_hide_show_elements.forEach(elem => elem.classList.remove('zrxiv_hide_show_hidden'));
			}
		};
	}

	render_tag(tag, checked)
	{
		const self = this;
		let label = document.importNode(self.ui.zrxiv_checkbox.content, true).firstChild;
		let checkbox = label.firstChild, span = label.lastChild;
		span.textContent = tag;
		checkbox.value = tag;
		checkbox.checked = checked;
		checkbox.onclick = async () => self.document_aciton('zrxiv_toggle_tag', [this.value, this.checked]);
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
			case 'zrxiv_toggle_tag':
				this.operation_status('toggling tag ' + arg[0], this.backend.sha != null);
				try
				{
					await this.backend.toggle_tag(arg[0], arg[1]);
				}
				catch(exception)
				{
					this.document_action('zrxiv_error', exception);
					return;
				}
				this.operation_status(null);
				break;

			case 'zrxiv_add_tag':
				this.operation_status('creating tag', true, this.ui.zrxiv_tag_add);
				try
				{
					await this.backend.add_tag(arg);
				}
				catch(exception)
				{
					this.document_action('zrxiv_error', exception);
					return;
				}
				this.operation_status(null, null, this.ui.zrxiv_tag_add);
				this.ui.zrxiv_tags.appendChild(this.render_tag(arg, true));
				this.ui.zrxiv_tag.value = '';
				//this.ui.zrxiv_tags.lastChild.firstChild.click();
				break;

			case 'zrxiv_save':
				this.operation_status('saving', true);
				try
				{
					await this.backend.add_doc();
				}
				catch(exception)
				{
					this.document_action('zrxiv_error', exception);
					return;
				}
				this.render_tags(true);
				await this.backend.auto_save(true);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete';
				this.operation_status(null);
				break;

			case 'zrxiv_delete':
				this.operation_status('deleting', true);
				try
				{
					await this.backend.del_doc();
				}
				catch(exception)
				{
					this.document_action('zrxiv_error', exception);
					return;
				}
				this.render_tags(false);
				await this.backend.auto_save(false);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
				this.operation_status(null);
				break;

			case 'zrxiv_delete_tag':
				this.operation_status('deleting', true, this.ui.zrxiv_delete_tag_button);
				try
				{
					await this.backend.del_tag(this.ui.zrxiv_delete_tag_button_status.dataset.tag);
				}
				catch(exception)
				{
					this.document_action('zrxiv_error', exception);
					return;
				}
				this.operation_status(null, null, this.ui.zrxiv_delete_tag_button);
				this.ui.zrxiv_delete_tag_button_status.className = 'zrxiv_delete_tag_ok';
				await delay(this.operation_timeout);
				window.location.href = this.home_page;
				break;

			case 'zrxiv_auto_save':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_auto_save';
				break;

			case 'zrxiv_prevent_auto_save':
				await this.backend.auto_save(false);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_save';
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

			case 'zrxiv_import':
				this.ui.zrxiv_toggle_status.className = 'zrxiv_import_selected';
				this.backend.doc = {tags : []};
				this.render_tags(true);
				break;

			case 'zrxiv_delete_selected':
				{
				const selected_docs = this.ui.zrxiv_doc_header.dataset.selected.split(' ');

				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = (0).toString();
				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_count = selected_docs.length.toString();
				this.ui.zrxiv_toggle_status.dataset.abort = false.toString();
				this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_delete';
				await delay(this.operation_timeout);

				for(let i = 1; i <= selected_docs.length && this.ui.zrxiv_toggle_status.dataset.abort == false.toString(); i++)
				{
					this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = i.toString();
					this.ui.zrxiv_toggle_status.className = 'zrxiv_deleting';
					this.operation_status('deleting', true);
					await this.backend.init_doc(selected_docs[i - 1]);
					try
					{
						await this.backend.del_doc();
					}
					catch(exception)
					{
						this.document_action('zrxiv_error', exception);
						return;
					}
					await this.backend.auto_save(false);
					this.operation_status(null);
					this.ui.zrxiv_deleted_docs.value += ' ' + this.backend.doc.id;
					this.ui.zrxiv_deleted_docs.dispatchEvent(new Event('change'));
					this.backend.doc = null;
				}
				this.ui.zrxiv_toggle_status.className = (this.ui.zrxiv_toggle_status.dataset.abort != false.toString()) ? 'zrxiv_delete_aborted' : 'zrxiv_delete_ok';
				await delay(this.operation_timeout);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete_selected';
				}
				break;

			case 'zrxiv_delete_selected_from_tag':
				{
				const selected_docs = this.ui.zrxiv_doc_header.dataset.selected.split(' ');
				const button = this.ui.zrxiv_delete_from_tag_button_status;
				button.dataset.zrxiv_operation_doc_idx = (0).toString();
				button.dataset.zrxiv_operation_doc_count = selected_docs.length.toString();
				button.dataset.abort = false.toString();
				button.className = 'zrxiv_prevent_delete';
				await delay(this.operation_timeout);

				for(let i = 1; i <= selected_docs.length && button.dataset.abort == false.toString(); i++)
				{
					button.dataset.zrxiv_operation_doc_idx = i.toString();
					button.className = 'zrxiv_deleting';
					this.operation_status('deleting', true, this.ui.zrxiv_delete_from_tag_button);
					await this.backend.init_doc(selected_docs[i - 1]);
					try
					{
						await this.backend.toggle_tag(button.dataset.tag, false);
					}
					catch(exception)
					{
						this.document_action('zrxiv_error', exception);
						return;
					}
					this.operation_status(null, null, this.ui.zrxiv_delete_from_tag_button);
					this.backend.doc = null;
				}
				
				button.className = (button.dataset.abort != false.toString()) ? 'zrxiv_delete_aborted' : 'zrxiv_delete_ok';
				await delay(this.operation_timeout);
				button.className = 'zrxiv_delete_selected_from_tag';
				}
				break;

			case 'zrxiv_import_selected':
				const bibs = ZrxivBibtex.parse(this.ui.zrxiv_bibtex_selected.title);

				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = (0).toString();
				this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_count = bibs.length.toString();
				this.ui.zrxiv_toggle_status.dataset.abort = false.toString();
				this.ui.zrxiv_toggle_status.className = 'zrxiv_prevent_import';
				await delay(this.operation_timeout);

				const tags = this.backend.doc.tags;
				for(let i = 1; i <= bibs.length && this.ui.zrxiv_toggle_status.dataset.abort == false.toString(); i++)
				{
					this.ui.zrxiv_toggle_status.dataset.zrxiv_operation_doc_idx = i.toString();
					this.ui.zrxiv_toggle_status.className = 'zrxiv_importing';
					this.operation_status('importing', true);
					await delay(this.operation_timeout);
					this.backend.sha = null;
					this.backend.doc = bibs[i - 1];
					this.backend.doc.tags = Array.from(new Set((this.backend.doc.tags || []).concat(tags))).sort();
					await this.backend.add_doc();
					this.operation_status(null);
					this.backend.doc = {tags : tags};
				}
				this.ui.zrxiv_toggle_status.className = (this.ui.zrxiv_toggle_status.dataset.abort != false.toString()) ? 'zrxiv_import_aborted' : 'zrxiv_import_ok';
				await delay(this.operation_timeout);
				this.ui.zrxiv_toggle_status.className = 'zrxiv_import_selected';
				break;

			case 'zrxiv_deleting':
			case 'zrxiv_prevent_delete':
				arg.dataset.abort = true.toString();
				arg.className = 'zrxiv_delete_aborted';
				break;

			case 'zrxiv_importing':
			case 'zrxiv_prevent_import':
				this.ui.zrxiv_toggle_status.dataset.abort = true.toString();
				this.ui.zrxiv_toggle_status.className = 'zrxiv_import_aborted';
				break;

			default:
				this.ui.zrxiv_toggle_status.className = 'zrxiv_delete_selected';
				if(!(action == 'zrxiv_' || action == 'zrxiv_all'))
				{
					const tag = action.split('zrxiv_').pop();
					this.ui.zrxiv_delete_tag_button.hidden = false;
					this.ui.zrxiv_delete_tag_button_status.dataset.tag = tag;
					this.ui.zrxiv_delete_from_tag_button.hidden = false;
					this.ui.zrxiv_delete_from_tag_button_status.dataset.tag = tag;
				}
				break;
		}
			
		this.ui.zrxiv_toggle.hidden = false;
		this.ui.zrxiv_hide_show.hidden = false;
	}

	operation_status(status_text, status, origin)
	{
		const all = this.ui.zrxiv_status_elements.concat(this.ui.zrxiv_checkboxes_labels());
		origin = origin || this.ui.zrxiv_toggle_status;

		[origin].forEach(el =>
		{
			el.disabled = false;
			el.title = status_text || 'ready';
			el.classList.remove(Array.from(el.classList).find(c => c.startsWith('zrxiv_status_')));
			el.classList.add('zrxiv_status_' + (status == true ? 'working' : (status == null || status == false) ? 'ok' : 'error'));
		});

		all.filter(el => el != origin).forEach(el => {el.disabled = true; el.title = 'Disabled during another operation'; });

		if(status == null || status == false)
			all.forEach(el => {el.disabled = false; el.title = ''; });
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

		this.render_tags(zrxiv_page == null, zrxiv_page == null ? this.backend.doc.tags : [], (tags.status == 200 ? await tags.json() : []).map(x => x.name.split('.').slice(0, -1).join('.')));
		if(zrxiv_page == null)
		{
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

	let zrxiv_page_url = frontend.github_repo.replace('http://', '').replace('https://', '').replace('github.com/', '').replace('/', '.github.io/');
	if(!zrxiv_page_url.endsWith('/'))
		zrxiv_page_url += '/';
	let page_type = window.location.hostname.endsWith('.github.io') ? (window.location.href.includes(zrxiv_page_url) ? 'zrxiv_' + window.location.href.split(zrxiv_page_url).pop().split('?')[0] : 'zrxiv_unknown') : null;
	
	if(page_type != null && page_type.endsWith('/'))
		page_type = page_type.slice(0, -1);

	if(page_type != 'zrxiv_unknown')
	{
		const target = document.getElementById('container') || document.body;
		target.insertBefore(container, target.firstChild);
		frontend.bind(page_type);
		await frontend.start(page_type);
	}
})();
