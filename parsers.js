async function arxiv(page, href, date)
{
	const xml = await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
	const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
	const [match, category, id] = new RegExp('.+arxiv.org/abs/(.+/)?([^v]+)', 'g').exec(entry.querySelector('id').innerText);
	const url = 'https://arxiv.org/abs/' + (category ? category + '/' + id : id)
	return {
		title : entry.querySelector('title').innerText, 
		authors : Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText),
		abstract : entry.querySelector('summary').innerText,
		id : 'arxiv.' + (category ? category + '_' + id : id),
		url : url,
		pdf : url.replace('arxiv.org/abs/', 'arxiv.org/pdf/'),
		source : 'arxiv.org',
		date : date,
		tags : []
	};
}

async function nips(page, href, date)
{
	const pdf = find_link_by_text(page, '[PDF]').replace('http://', 'https://');
	const bibtex = find_link_by_text(page, '[BibTeX]').replace('http://', 'https://');
	return {
		title : page.querySelector('.subtitle').innerText,
		authors : Array.from(page.querySelectorAll('.author')).map(elem => elem.innerText),
		abstract : page.querySelector('.abstract').innerText,
		id : 'neurips.' + new RegExp('/paper/(\\d+)-.+').exec(pdf)[1],
		url : href,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(bibtex).text())),
		source : 'nips.cc',
		date : date,
		tags : []
	};
}

async function openreview(page, href, date)
{
	const entry = (await (await fetch(href.replace('/forum?id=', '/notes?forum='))).json()).notes.filter(note => note.original != null)[0];
	return {
		title : entry.content.title,
		authors : entry.content.authors,
		abstract : entry.content.abstract,
		id : 'openreview.' + entry.id,
		url : href,
		pdf : 'https://openreview.net' + entry.content.pdf,
		bibtex : format_bibtex(entry.content._bibtex),
		source : 'openreview.net',
		date : date,
		tags : []
	}
}

async function cvf(page, href, date)
{
	const pdf = find_link_by_text(page, 'pdf');
	return {
		title : page.querySelector('#papertitle').innerText,
		authors : document.querySelector('#authors i').innerText.split(',').map(s => s.trim()),
		abstract : page.querySelector('#abstract').innerText,
		id : 'cvf.' + pdf.split('/').pop().replace('_paper.pdf', ''),
		url : href,
		pdf : pdf,
		bibtex : format_bibtex(page.querySelector('.bibref').innerText),
		source : 'thecvf.com',
		date : date,
		tags : [],

		arxiv : find_link_by_text(page, 'arXiv')
	}
}

async function hal(page, href, date)
{
	const entry = (await (await fetch(href + (href.endsWith('/') ? '' : '/') + 'json')).json()).response.docs[0];
	return {
		title : entry.title_s[0],
		authors : entry.authFullName_s,
		abstract : entry.abstract_s[0],
		id : 'hal.' + entry.halId_s.replace('hal-', ''),
		url : entry.uri_s,
		pdf : entry.files_s[0],
		bibtex : format_bibtex(entry.label_bibtex),
		source : 'hal.archives-ouvertes.fr',
		date : date,
		tags : []
	}
}

async function biorxiv(page, href, date)
{
	return {
		title : page.querySelector('meta[name="citation_title"]').content,
		authors : Array.from(page.querySelectorAll('meta[name="citation_author"]')).map(meta => meta.content),
		abstract : page.querySelector('meta[name="citation_abstract"]').content,
		id : 'biorxiv.' + strip_version(page.querySelector('meta[name="citation_id"]').content),
		url : page.querySelector('link[rel="citation_public_url"]').href,
		pdf : page.querySelector('meta[name="citation_pdf_url"]').content,
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, 'BibTeX'))).text()),
		source : 'biorxiv.org',
		date : date,
		tags : [],

		doi : page.querySelector('meta[name="citation_doi"]').content
	}
}

function find_link_by_text(page, text)
{
	return page.evaluate('//a[text()="['+ text + ']"]', page).iterateNext().href;
}

function strip_version(doc_id)
{
	return new RegExp('(.+)v.+', 'g').exec(doc_id)[1];
}

function format_bibtex(bibtex)
{
	return bibtex.replace('\n\n', '\n').replace('    \n', '\n').replace('    ', ' ').replace('\n', '\n  ').replace('\n  }', '\n}').replace('@InProceedings', '@inproceedings').trim();
}

function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org/abs/' : arxiv, 'papers.nips.cc/paper/' : nips, 'openreview.net/forum' : openreview, 'openaccess.thecvf.com' : cvf, 'hal.' : hal, 'biorxiv.org/content' : biorxiv};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
