async function arxiv(page, href, date)
{
	const entry = page.createRange().createContextualFragment(await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text()).querySelector('entry');
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : decomma_authors(find_meta(page, 'citation_author', Array)),
		abstract : entry.querySelector('summary').innerText,
		id : 'arxiv.' + find_meta(page, 'citation_arxiv_id').replace('/', '_'),
		url : pdf.replace('/pdf/', '/abs/'),
		pdf : pdf,
		source : 'arxiv.org',
		date : date,
		tags : []
	};
}

async function nips(page, href, date)
{
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract').innerText,
		id : 'neurips.' + new RegExp('/paper/(\\d+)-.+').exec(pdf)[1],
		url : href,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, '[BibTeX]').replace('http://', 'https://'))).text()),
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
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : decomma_authors(find_meta(page, 'citation_author', Array)),
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
		authors : decomma_authors(find_meta(page, 'citation_author', Array)),
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

function pmlr(page, href, date)
{
	const url = find_meta(page, 'citation_abstract_html_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract').innerText,
		id : 'mlr.' + new RegExp(/.+\/(v\d+)\/(.+).html/, 'g').exec(url).slice(1).join('.'),
		url : url,
		pdf : find_meta(page, 'citation_pdf_url'),
		bibtex : format_bibtex(page.querySelector('#bibtex').innerText),
		source : 'mlr.press',
		date : date,
		tags: [],
	}
}

async function jmlr(page, href, date)
{
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('#content>h3').nextSibling.textContent.trim(),
		id : 'jmlr.' + new RegExp(/.+\/papers\/(.+)\/(.+)\/.+/, 'g').exec(pdf).slice(1).join('.'),
		url : pdf.replace('.pdf', '.html'),
		pdf : pdf,
		bibtex : await (await fetch(find_link_by_text(page, 'bib'))).text(),
		source : 'jmlr.org',
		date : date,
		tags : []
	}
}

async function iacr(page, href, date)
{
	const a = page.querySelectorAll('p a');
	const url = a[a.length - 1];
	const p = page.querySelectorAll('p');
	let abstract = '';
	for(let i = 3; i < p.length; i++)
	{
		if(p[i].innerText.includes('Category'))
			break;

		abstract += p[i].lastChild.textContent + ' ';
	}
	return {
		title : page.querySelector('b').innerText,
		authors : page.querySelector('i').innerText.split(' and '),
		abstract : abstract.trim(),
		id : 'iacr.' + url.innerText.replace('.', '').replace(/\//g, '.'),
		url : url.href,
		pdf : a[0].href,
		bibtex : page.createRange().createContextualFragment(await (await fetch(a[1].href)).text()).querySelector('pre').innerText,
		source : 'iacr.org',
		date : date,
		tags : []
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
	return new RegExp('(.+)(v.+)?', 'g').exec(doc_id)[1];
}

function decomma_authors(authors)
{
	return authors.map(a => a.split(', ').reverse().join(' '));
}

function format_bibtex(bibtex)
{
	/*const entry_type_key = new RegExp(/\s*(@.+)\s*{\s*([^,]+)\s*,/, 'g');
	const field = new RegExp(/(.+)/, 'g');
	const [entry_type, key] = entry_type_key.exec(bibtex).slice(1);

	bibtex = bibtex.replace(entry_type_key, '{')
	bibtex = bibtex.replace(new RegExp(/\b(.+)\s*=/, 'g'), '$1 :');*/
	// https://stackoverflow.com/questions/34221996/how-to-parse-complex-bibtex-items-with-javascript-and-regex
	
	return bibtex.replace(/\n\n/g, '\n').replace(/    \n/g, '\n').replace(/    /g, ' ').replace(/\t/g, ' ').replace(/\n/g, '\n  ').replace(/\n  }/g, '\n}').replace('@InProceedings', '@inproceedings').trim();
}

function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org' : arxiv, 'nips.cc' : nips, 'openreview.net' : openreview, 'openaccess.thecvf.com' : cvf, 'hal.' : hal, 'biorxiv.org' : biorxiv, 'pnas.org' : pnas, 'papers.ssrn.com' : ssrn, "projecteuclid.org" : projecteuclid, 'journals.aps.org' : aps, 'proceedings.mlr.press' : pmlr, 'jmlr.org' : jmlr, 'eprint.iacr.org' : iacr};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
