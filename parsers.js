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

function biorxiv(page, href, date)
{
	return highwire(page, href, date, 'biorxiv', 'biorxiv.org');
}

function pnas(page, href, date)
{
	return highwire(page, href, date, 'pnas', 'pnas.org');
}

async function ssrn(page, href, date)
{
	const doi = find_meta(page, 'citation_doi');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array).map(author => author.split(', ').reverse().join(' ')),
		abstract : page.querySelector('.abstract-text>p').innerText,
		id : doi.split('/')[1],
		url : find_meta(page, 'citation_abstract_html_url'),
		pdf : find_meta(page, 'citation_pdf_url'),
		bibtex : format_bibtex(await bibtex_crossref(doi)),
		source : 'ssrn.com',
		date : date,
		tags : [],
		doi : doi
	}
}

async function projecteuclid(page, href, date)
{
	const url = find_meta(page, 'citation_abstract_html_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract-text>p').innerText,
		id : url.replace('https://projecteuclid.org/', '').replace('/', '_'),
		url : url,
		pdf : find_meta(page, 'citation_pdf_url'),
		bibtex : format_bibtex(await (await fetch(url.replace('.org/', '.org/export_citations?format=bibtex&h='))).text()),
		source: 'projecteuclid.org',
		date : date,
		tags : [],
		doi : find_meta(page, 'citation_doi')
	}
}

async function aps(page, href, date)
{
	const doi = find_meta(page, 'citation_doi');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract .content >p').innerText,
		id : 'aps.' + strip_doi_part(doi),
		url : page.querySelector('link[rel="canonical"]').href,
		pdf : find_meta(page, 'citation_pdf_url'),
		bibtex : await (await fetch(page.querySelector('meta[property="og:url"]').content.replace('abstract', 'export'))).text(),
		source : 'aps.org',
		date : date,
		tags : [],
		doi : doi
	}
}

async function highwire(page, href, date, provider, source)
{
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : find_meta(page, 'citation_abstract'),
		id : provider + '.' + strip_version(find_meta(page, 'citation_id')),
		url : find_meta(page, 'citation_public_url'),
		pdf : find_meta(page, 'citation_pdf_url'),
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, 'BibTeX'))).text()),
		source : source,
		date : date,
		tags : [],
		doi : find_meta(page, 'citation_doi')
	}
}

async function bibtex_crossref(doi)
{
	return (await fetch('https://dx.doi.org/' + doi, { headers: {'Accept' : 'text/bibliography; style=bibtex'} } )).text();
}

function find_meta(page, text, type)
{
	const selector = 'meta[name="' + text + '"]';
	return type == Array ? Array.from(page.querySelectorAll(selector)).map(meta => meta.content) : page.querySelector(selector).content;
}

function strip_doi_part(doi)
{
	return doi.split('/')[1].replace('.', '_');
}

function find_link_by_text(page, text)
{
	return page.evaluate('//a[text()="'+ text + '"]', page).iterateNext().href;
}

function strip_version(doc_id)
{
	return new RegExp('(.+)v.+', 'g').exec(doc_id)[1];
}

function format_bibtex(bibtex)
{
	return bibtex.replace('\n\n', '\n').replace('    \n', '\n').replace('    ', ' ').replace('\t', ' ').replace('\n', '\n  ').replace('\n  }', '\n}').replace('@InProceedings', '@inproceedings').trim();
}

function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org/abs/' : arxiv, 'papers.nips.cc/paper/' : nips, 'openreview.net/forum' : openreview, 'openaccess.thecvf.com' : cvf, 'hal.' : hal, 'biorxiv.org/content' : biorxiv, 'pnas.org/content' : pnas, 'papers.ssrn.com/sol3/papers.cfm' : ssrn, "projecteuclid.org" : projecteuclid, 'journals.aps.org' : aps};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
