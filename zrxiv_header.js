var zrxiv_api = null;

class GithubZrxivApi
{
	constructor(api, auth_token, doc_id)
	{
		this.api = api;
		this.auth_token = auth_token;
		this.doc_id = doc_id;
	}

	get_doc()
	{
		console.log('zrxiv', 'doc get', this.doc_id);
		return fetch(this.api + '/contents/_data/documents/' + this.doc_id + '.json', 
		{
			headers : {'Authorization' : 'Basic ' + btoa(this.auth_token)}
		});
	}

	get_tags()
	{
		console.log('zrxiv', 'tags get');
		return fetch(this.api + '/contents/_data/tags',
		{
			headers : {'Authorization' : 'Basic ' + btoa(this.auth_token)}
		});
	}

	put_doc(message, doc, sha)
	{
		console.log('zrxiv', 'doc put', this.doc_id);
		var body = {message : message + this.doc_id, content : btoa(JSON.stringify(doc, null, 2))};
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

	del_doc()
	{
		console.log('zrxiv', 'doc del', this.doc_id);
		return this.get_doc()
			.then(res => res.json())
			.then(res =>
			{
				return fetch(this.api + '/contents/_data/documents/' + this.doc_id + '.json',
				{
					method : 'delete',
					headers : 
					{
						'Content-Type' : 'application/json',
						'Authorization' : 'Basic ' + btoa(this.auth_token)
					},
					body : JSON.stringify({message : 'Delete ' + this.doc_id, sha : res.sha})
				})
			});
	}

	add_tag(tag)
	{
		console.log('zrxiv', 'tag add', tag);
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

	toggle_tag(tag, checked)
	{
		console.log('zrxiv', 'doc tag', this.doc_id, tag, checked);
		return this.get_doc()
			.then(res => res.json())
			.then(res =>
			{
				var doc = JSON.parse(atob(res.content));
				var checked_old = doc.tags.indexOf(tag) != -1;
				if(checked && !checked_old)
					doc.tags.push(tag);
				else if(!checked && checked_old)
					doc.tags = doc.tags.filter(x => x != tag);

				zrxiv_api.put_doc('Change tag of ', doc, res.sha);
			});
	}

	prevent_auto_save(action)
	{
		if(action == null)
		{
			return new Promise(function(resolve)
			{
				chrome.storage.sync.get({prevent_auto_save : []}, function(res) { resolve(res.prevent_auto_save.indexOf(this.doc_id) >= 0); } );
			});
		}
		else if(action == true)
		{
			chrome.storage.sync.get({prevent_auto_save : []}, function(res) {
				var docs = res.prevent_auto_save;
				if(docs.indexOf(this.doc_id) < 0)
				{
					docs.push(this.doc_id);
					chrome.storage.sync.set({prevent_auto_save : docs}, function(){});
				}
			});
		}
		else if(action == false)
		{
			chrome.storage.sync.get({prevent_auto_save : []}, function(res) {
				var docs = res.prevent_auto_save;
				if(docs.indexOf(this.doc_id) >= 0)
				{
					docs = docs.filter(x => x != this.doc_id);
					chrome.storage.sync.set({prevent_auto_save : docs}, function(){});
				}
			});
		}
	}
}

function zrxiv_make_checkbox(tag, checked)
{
	var checkbox = document.createElement('input');
	checkbox.type = 'checkbox'
	checkbox.className = 'zrxiv_checkbox';
	checkbox.value = tag;
	checkbox.checked = checked;
	checkbox.addEventListener('change', function() { if(this.style.display != 'none') zrxiv_api.toggle_tag(this.value, this.checked); });
	var label = document.createElement('label');
	label.appendChild(checkbox);
	label.appendChild(document.createTextNode(tag));
	return label;
}

function zrxiv_toggle(action, arg)
{
	var zrxiv_toggle_button = document.getElementById('zrxiv_toggle');
	if(action == 'auto-save')
	{
		zrxiv_toggle_button.innerText = 'Prevent auto-save in ' + arg + ' seconds';
		zrxiv_toggle_button.dataset.action = 'prevent-auto-save';
	}
	else if(action == 'prevent-auto-save')
	{
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
		zrxiv_api.prevent_auto_save(true);
	}
	else if(action == 'save' || action == 'saved')
	{
		if(action == 'save')
		{
			var doc = {id : zrxiv_api.doc_id, title : document.title, url : window.location.href, date : Math.floor(new Date().getTime() / 1000), tags : [] };
			zrxiv_api.put_doc('Add ', doc)
				.then(res => zrxiv_tags_render(true))
				.then(res => zrxiv_api.prevent_auto_save(false));
		}
		zrxiv_toggle_button.dataset.action = 'delete';
		zrxiv_toggle_button.innerText = 'Delete';
	}
	else if(action == 'delete')
	{
		zrxiv_document_del()
			.then(res => zrxiv_tags_render(false))
			.then(res => zrxiv_api.prevent_auto_save(true));
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
	}
	zrxiv_toggle_button.style.display = '';
}

function zrxiv_tags_render(show, tags_on, tags)
{
	var zrxiv_tags = document.getElementById('zrxiv_tags');
	if(tags_on != null)
	{
		if(tags.length == 0)
			zrxiv_tags.innerHTML = '(no tags exist yet)';
		else
		{
			zrxiv_tags.innerHTML = '';
			tags.forEach(tag => zrxiv_tags.appendChild(zrxiv_make_checkbox(tag, tags_on.indexOf(tag) != -1)))
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
	let response = await fetch(window.location.href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='));
	let xml = await response.text();

	var entry = document.createRange().createContextualFragment(xml).querySelector('entry');
	var abs = entry.querySelector('summary').innerText;
	var title = entry.querySelector('title').innerText;
	var authors = Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText);
	
	return {
		title : title 
		url : window.location.href,
		author : authors,
		abstract : abs
	};
}

function zrxiv_init(options)
{
	if(options.zrxiv_github_repo == null || options.zrxiv_github_token == null)
	{
		document.getElementById('zrxiv_options').href = chrome.runtime.getURL('zrxiv_options.html');
		document.getElementById('zrxiv_options_missing').style.display = ''; 
		document.getElementById('zrxiv_site').href = chrome.runtime.getManifest().homepage_url;
		return;
	}

	var match = new RegExp('([^/]+)\.github.io/(.+)', 'g').exec(options.zrxiv_github_repo);
	var username = match[1], repo = match[2];

	//var parsed_doc = parse_arxiv_document();
	var zrxiv_auto_save_timeout = options.zrxiv_auto_save_timeout != null ? parseInt(options.zrxiv_auto_save_timeout) : null;
	zrxiv_api = new GithubZrxivApi('https://api.github.com/repos/' + username + '/' + repo, username + ':' + options.zrxiv_github_token, new RegExp('abs/(\\d+\.\\d+)', 'g').exec(window.location.href)[1]);

	document.getElementById('zrxiv_site').href = options.zrxiv_github_repo.startsWith('http') ? options.zrxiv_github_repo : 'https://' + options.zrxiv_github_repo;
	document.getElementById('zrxiv_tag_add').addEventListener('click', function(event)
	{
		var tag = document.getElementById('zrxiv_tag').value;
		zrxiv_api.add_tag(tag)
			.then(res => zrxiv_api.toggle_tag(tag, true))
			.then(res => {
				document.getElementById('zrxiv_tags').appendChild(zrxiv_make_checkbox(tag, true));
				document.getElementById('zrxiv_tag').value = '';
			});
	});
	document.getElementById('zrxiv_toggle').addEventListener('click', function(event) { zrxiv_toggle(this.dataset.action); } );
	document.getElementById('zrxiv_tag').addEventListener('keyup', function(event) { if (event.keyCode == 13) document.getElementById('zrxiv_tag_add').click(); });

	Promise.all([zrxiv_api.get_doc(), zrxiv_api.get_tags()])
		.then(resps => Promise.all([resps[0].status == 200 ? resps[0].json() : null, resps[1].status == 200 ? resps[1].json() : []]))
		.then(([doc, tags]) => 
		{
			zrxiv_tags_render(false, doc != null ? JSON.parse(atob(doc.content)).tags : [], tags.map(x => x.name.split('.').slice(0, -1).join('.')));
					
			if(doc != null)
			{
				zrxiv_tags_render(true);
				zrxiv_toggle('saved');
			}
			else
			{
				zrxiv_api.prevent_auto_save().then(res =>
				{
					if(res || !zrxiv_auto_save_timeout)
					{
						zrxiv_toggle('prevent-auto-save');
					}
					else
					{
						zrxiv_toggle('auto-save', zrxiv_auto_save_timeout);
						var timer = setInterval(function() {
							clearInterval(timer);
							zrxiv_toggle('save');
						}, zrxiv_auto_save_timeout * 1000);
					}
				});
			}
		});
}

fetch(chrome.extension.getURL('zrxiv_header.html'))
	.then(resp => resp.text())
	.then(zrxiv_header_html => { chrome.storage.sync.get({zrxiv_github_repo: null, zrxiv_github_token: null, zrxiv_auto_save_timeout: null}, function(options) 
		{
			var container = document.createElement('div');
			container.innerHTML = zrxiv_header_html;
			document.body.insertBefore(container, document.body.firstChild);

			zrxiv_init(options);
		});	
	});
