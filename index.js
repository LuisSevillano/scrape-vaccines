var Promise = require('bluebird');
var request = require('request-promise');
var cheerio = require('cheerio');
var fs = require('fs');
var d3Dsv = require('d3-dsv');
var mkdirp = require('mkdirp');
var d3 = require("d3");

var url = 'https://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';

/// Gathers links corresponding to each country individual info page.
function scrapeLinks() {
	var startingUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do';
	var countryUrls = [];

	// Makes a request to the startingUrl and then, from the response (which is the startingUrl's HTML),
	// gathers all of the links corresponding to each country individual page.
	request(startingUrl, function (error, response, body) {
		var baseUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';
		var $ = cheerio.load(body);
		// basic error handling
		if (error) {
			throw new Error(error);
		}

		// get urls of each country from the Select 'HTML element' without the default option which has no data associated
		// and fill and array
		$('#pais > option:not(:selected)').each(function(i, el) {
			$ = cheerio.load(el);

			var countryLinkId = $(this).val();
			countryUrls[i] = baseUrl + countryLinkId;
		});

		scrapeInfo([countryUrls[0]]);
	});
}

// Makes a request to each link corresponding to a country page and creates an object based on that country
// information, and then sends that object to makeTSV to be put into TSV/spreadsheet format.
function scrapeInfo(countryUrls) {
	var countryInfo = [];
	Promise.map(countryUrls, function(countryUrl) {

		return request(countryUrl, function(error, response, body) {
			// first of all I was testing this individual code for each page using chrome's Snippets from the dev tools
			// to prevent be banned/blocked because of make multiple requests
			var $ = cheerio.load(body);

			if (error) {
				throw new Error(error);
			}
			// this object has some default options filled if those fields doesn't exist on individual page
			var countryObj = {
				"codISO":"",
				"Nombre": "",
				"Paludismo": "No existe riesgo de paludismo",
				"Vacunas exigidas": "Ninguna",
				"Vacunas recomendadas": "Ninguna",
				"Capital": "",
				"Lengua": "",
				"Altitud": "",
				"Población": "",
				"Moneda": "",
				"Zona horaria": "",
				"Clima": "",
				"Cancillería Española": "",
				"URL": countryUrl,
				"pageId":countryUrl.substring(countryUrl.lastIndexOf('=') + 1)
			};
			var countryName = toTitleCase($("h2").text());
			var tables = $('.imagen_texto table'),
			details = tables[0],
			vacRequired = tables[1],
			vacReccom = tables[2];
			paludismo = tables[3];

			tables.each(function(d){
				var tableHeader = $(this).find("th").text().trim();
				if(tableHeader == "VACUNAS EXIGIDAS"){
					vacRequired = this;
					countryObj["Vacunas exigidas"] = $(this).find("td").text().trim();
				}
				else if(tableHeader == "VACUNAS RECOMENDADAS"){
					vacReccom = this;
					countryObj["Vacunas recomendadas"] = $(vacReccom).find("td").text().trim();
				}
				else if(tableHeader == "Paludismo"){
					paludismo = this;
					countryObj["Paludismo"] = $(paludismo).find("td").text().trim()
				}
			})

			fs.readFile('ISO_3166-1.tsv', 'utf8', function(error, tsv) {
			  data = d3.tsvParse(tsv);
				data.forEach(function(d){
					var codISO = d.code,
					pageId = d.pageId;
					if (countryObj["pageId"] == pageId) {
						console.log("---MATCH!!!");
						countryObj["codISO"] = codISO;
						console.log(countryObj["codISO"]);
						return;
					}
				})
			})



			// set country name
			countryObj["Nombre"] = countryName;
			$(details).find("tr").each(function(d, i){
				var property = $(this).find("th").text().trim(),
				value = $(this).find("td").text().trim();
				countryObj[property] = value;
			});

			// add a new country to the main array
			countryInfo.push(countryObj);
		});
	})
	.then(function() {
		// only calles this function once all of the countryObj have been pushed into countryInfo
		makeTSV(countryInfo);
	});
}

function makeTSV(countryInfo) {
	mkdirp('data', function (err) {
		if (err) console.error(err)
		else fs.writeFile('data/countryInfo.tsv', d3Dsv.tsvFormat(countryInfo));
	});

}
function toTitleCase(str) {
	return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
scrapeLinks();
