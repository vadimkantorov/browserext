var zrxiv_document_id = null;
var zrxiv_document_add_auto = null;
var zrxiv_github_username_token = null;
var zrxiv_github_api = null;
var zrxiv_auto_save_timeout = null;

function zrxiv_document_get()
{
	console.log('zrxiv', 'doc get', zrxiv_document_id);
	return fetch(zrxiv_github_api + '/contents/_data/documents/' + zrxiv_document_id + '.json', 
	{
		headers : {
			'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token)
		}
	});
}

function zrxiv_tags_get()
{
	console.log('zrxiv', 'tags get');
	return fetch(zrxiv_github_api + '/contents/_data/tags',
	{
		headers : {
			'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token)
		}
	});
}

function zrxiv_document_put(doc)
{
	console.log('zrxiv', 'doc put', zrxiv_document_id);
	return fetch(zrxiv_github_api + '/contents/_data/documents/' + zrxiv_document_id + '.json',
	{
		method : 'put',
		headers : {
			'Content-Type' : 'application/json',
			'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token)
		},
		body : JSON.stringify(doc)
	})
}

function zrxiv_document_del()
{
	console.log('zrxiv', 'doc del', zrxiv_document_id);
	return fetch(zrxiv_github_api + '/contents/_data/documents/' + zrxiv_document_id + '.json', { headers : {'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token) } })
		.then(res => res.json())
		.then(res =>
		{
			return fetch(zrxiv_github_api + '/contents/_data/documents/' + zrxiv_document_id + '.json',
			{
				method : 'delete',
				headers : {
					'Content-Type' : 'application/json',
					'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token)
				},
				body : JSON.stringify({message : 'Delete ' + zrxiv_document_id, sha : res.sha})
			})
		});
}

function zrxiv_tag_add(tag)
{
	console.log('zrxiv', 'tag add', tag);
	return fetch(zrxiv_github_api + '/contents/_data/tags/' + tag + '.json',
	{
		method : 'put',
		headers : {
			'Content-Type' : 'application/json',
			'Authorization' : 'Basic ' + btoa(zrxiv_github_username_token)
		},
		body : JSON.stringify({message : 'Create tag ' + tag, content : '' })
	});
}

function zrxiv_tag_changed(tag, checked)
{
	console.log('zrxiv', 'doc tag', zrxiv_document_id, tag, checked);
	return zrxiv_document_get()
		.then(res => res.json())
		.then(res =>
		{
			var doc = JSON.parse(atob(res.content));
			var checked_old = doc.tags.indexOf(tag) != -1;
			if(checked && !checked_old)
				doc.tags.push(tag);
			else if(!checked && checked_old)
				doc.tags = doc.tags.filter(x => x != tag);

			zrxiv_document_put({sha : res.sha, message : 'Change tag of ' + zrxiv_document_id, content : btoa(JSON.stringify(doc, null, 2))});
		});
}

function zrxiv_make_checkbox(tag, checked)
{
	var checkbox = document.createElement('input');
	checkbox.type = 'checkbox'
	checkbox.className = 'zrxiv_checkbox';
	checkbox.value = tag;
	checkbox.checked = checked;
	checkbox.addEventListener('change', function() { if(this.style.display != 'none') zrxiv_tag_changed(this.value, this.checked); });
	var label = document.createElement('label');
	label.appendChild(checkbox);
	label.appendChild(document.createTextNode(tag));
	return label;
}

function prevent_auto_save(action)
{
	if(action == 'check')
	{
		return new Promise(function(resolve)
		{
			chrome.storage.sync.get({prevent_auto_save : []}, function(res) { resolve(res.prevent_auto_save.indexOf(zrxiv_document_id) >= 0); } );
		});
	}
	else if(action == 'add')
	{
		chrome.storage.sync.get({prevent_auto_save : []}, function(res) {
			var docs = res.prevent_auto_save;
			if(docs.indexOf(zrxiv_document_id) < 0)
			{
				docs.push(zrxiv_document_id);
				chrome.storage.sync.set({prevent_auto_save : docs}, function(){});
			}
		});
	}
	else if(action == 'remove')
	{
		chrome.storage.sync.get({prevent_auto_save : []}, function(res) {
			var docs = res.prevent_auto_save;
			if(docs.indexOf(zrxiv_document_id) >= 0)
			{
				docs = docs.filter(x => x != zrxiv_document_id);
				chrome.storage.sync.set({prevent_auto_save : docs}, function(){});
			}
		});
	}
}

function zrxiv_toggle(action)
{
	var zrxiv_toggle_button = document.getElementById('zrxiv_toggle');
	if(action == 'auto-save')
	{
		zrxiv_toggle_button.innerText = 'Prevent auto-save in ' + zrxiv_auto_save_timeout + ' seconds';
		zrxiv_toggle_button.dataset.action = 'prevent-auto-save';
	}
	else if(action == 'prevent-auto-save')
	{
		zrxiv_document_add_auto = false;
		zrxiv_toggle_button.dataset.action = 'save';
		zrxiv_toggle_button.innerText = 'Save';
		prevent_auto_save('add');
	}
	else if(action == 'save' || action == 'saved')
	{
		if(action == 'save')
		{
			zrxiv_document_put({ message : 'Add ' + zrxiv_document_id, content : btoa(JSON.stringify({id : zrxiv_document_id, title : document.title, url : window.location.href, date : Math.floor(new Date().getTime() / 1000), tags : [] }, null, 2)) })
				.then(res => zrxiv_tags_render(true))
				.then(res => prevent_auto_save('remove'));
		}
		zrxiv_toggle_button.dataset.action = 'delete';
		zrxiv_toggle_button.innerText = 'Delete';
	}
	else if(action == 'delete')
	{
		zrxiv_document_del()
			.then(res => zrxiv_tags_render(false))
			.then(res => prevent_auto_save('add'));
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

function parse_arxiv_document()
{
	fetch('https://export.arxiv.org/api/query?id_list=' + new RegExp('abs/(\\d+\.\\d+)', 'g').exec(window.location.href)[1]).then(res => res.text()).then(res => {
		var entry = document.createRange().createContextualFragment(res).querySelector('entry');
		var abs = entry.querySelector('summary').innerText;
		var title = entry.querySelector('title').innerText;
		var authors = Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText);
	});

	return {
		id : new RegExp('abs/(\\d+\.\\d+)', 'g').exec(window.location.href)[1],
		title : document.title, 
		url : window.location.href,
		authors : Array.from(document.querySelectorAll('.authors a')).map(elem => elem.innerText)
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

	var parsed_doc = parse_arxiv_document();
	zrxiv_document_id = new RegExp('abs/(\\d+\.\\d+)', 'g').exec(window.location.href)[1];
	zrxiv_document_add_auto = true;
	zrxiv_github_username_token = username + ':' + options.zrxiv_github_token;
	zrxiv_github_api = 'https://api.github.com/repos/' + username + '/' + repo;
	zrxiv_auto_save_timeout = options.zrxiv_auto_save_timeout != null ? parseInt(options.zrxiv_auto_save_timeout) : null;

	document.getElementById('zrxiv_site').href = options.zrxiv_github_repo.startsWith('http') ? options.zrxiv_github_repo : 'https://' + options.zrxiv_github_repo;
	document.getElementById('zrxiv_tag_add').addEventListener('click', function(event)
	{
		var tag = document.getElementById('zrxiv_tag').value;
		zrxiv_tag_add()
			.then(res => zrxiv_tag_changed(tag, true))
			.then(res => {
				document.getElementById('zrxiv_tags').appendChild(zrxiv_make_checkbox(tag, true));
				document.getElementById('zrxiv_tag').value = '';
			});
	});
	document.getElementById('zrxiv_toggle').addEventListener('click', function(event) { zrxiv_toggle(this.dataset.action); } );
	document.getElementById('zrxiv_tag').addEventListener('keyup', function(event) { if (event.keyCode == 13) document.getElementById('zrxiv_tag_add').click(); });

	Promise.all([zrxiv_document_get(), zrxiv_tags_get()])
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
				prevent_auto_save('check').then(res =>
				{
					if(res || !zrxiv_auto_save_timeout)
						zrxiv_toggle('prevent-auto-save');
					else
					{
						zrxiv_toggle('auto-save');
						var timer = setInterval(function() {
							clearInterval(timer);
							if(zrxiv_document_add_auto)
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
