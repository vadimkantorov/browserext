function base64_encode_utf8(str)
{
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {return String.fromCharCode(parseInt(p1, 16)) }));
}

function network_error(resp)
{
	return new Error(`${resp.status}: ${resp.statusText}`);
}

class ZrxivGithubBackend
{
	constructor(github_username, github_repo, github_token, href)
	{
		this.api = `https://api.github.com/repos/${github_username}/${github_repo}`;
		this.auth_token = `${github_username}:${github_token}`;
		this.href = href;
		this.doc = null;
		this.sha = null;
		this.retry_delay_seconds = 2;
	}

	github_api_request(relative_url, method, body)
	{
		return fetch(this.api + relative_url, Object.assign({method : method || 'get', headers : Object.assign({Authorization : 'Basic ' + btoa(this.auth_token)}, body != null ? {'Content-Type' : 'application/json'} : {})}, body != null ? {body : JSON.stringify(body)} : {}));
	}

	async init_doc(id)
	{
		this.doc = id == null ? await parse_doc(document, this.href, Math.floor(new Date().getTime() / 1000)) : {id : id};
		const resp = await this.github_api_request(`/contents/data/documents/${this.doc.id}.json`);
		if(resp.ok)
		{
			const {content, sha} = await resp.json();
			this.doc = JSON.parse(atob(content));
			this.sha = sha;
		}
		else if(resp.status != 404)
			throw network_error(resp);
	}

	async put_doc(message, sha, retry)
	{
		const resp = await this.github_api_request(`/contents/data/documents/${this.doc.id}.json`, 'put', Object.assign({message : message + this.doc.id, content : base64_encode_utf8(JSON.stringify(this.doc, null, 2))}, sha ? {sha : sha} : {}))
		if(resp.ok)
			this.sha = (await resp.json()).content.sha;
		else if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			await this.put_doc(message, sha ? ((await this.init_doc()) || this.sha) : null, false);
		}
		else
			throw network_error(resp);
	}

	async del_doc(retry)
	{
		const resp = await this.github_api_request(`/contents/data/documents/${this.doc.id}.json`, 'delete', {message : 'Delete ' + this.doc.id, sha : this.sha})
		if(resp.ok)
			this.sha = null;
		else if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			await this.init_doc();
			return this.del_doc(false);
		}
		else
			throw network_error(resp);
	}

	async add_tag(tag, retry)
	{
		const resp = await this.github_api_request(`/contents/data/tags/${tag}.md`, 'put', {message : 'Create tag ' + tag, content : '' })
		if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			return this.add_tag(tag, false);
		}
		else if(!resp.ok)
			throw network_error(resp);
	}

	async del_tag(tag)
	{
		const tag_url = `/contents/data/documents/${tag}.md`;
		let resp = await this.github_api_request(tag_url);
		if(resp.ok)
			resp = await this.github_api_request(tag_url, 'delete', {message : 'Delete tag ' + tag, sha : (await resp.json()).sha});

		if(resp.status == 409 && retry != false)
		{
			await delay(this.retry_delay_seconds);
			return this.del_tag(tag, false);
		}
		else if(!resp.ok)
			throw network_error(resp);
	}

	get_tags()
	{
		return this.github_api_request('/contents/data/tags');
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
		else if(action == true)
		{
			delete prevent_auto_save[this.doc.id];
			await browser.storage.sync.set({prevent_auto_save : prevent_auto_save});
		}
	}

	is_anonymous_submission()
	{
		return this.doc != null && this.doc.authors.indexOf('Anonymous') >= 0;
	}
}
