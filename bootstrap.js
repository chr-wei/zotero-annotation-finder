/*
 * AnnotationFinder Plugin v1.0.0
 */

var AnnotationFinder;

function install(data, reason) { }
function uninstall(data, reason) { }

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }) {
	await Zotero.initializationPromise;

	try {
		Services.scriptloader.loadSubScript(rootURI + 'content/board.js?' + Date.now());
	} catch (e) {
		Zotero.debug("AnnotationFinder: Error loading board.js: " + e);
	}

	if (AnnotationFinder) {
		AnnotationFinder.init({ id, version, rootURI });
		for (let win of Zotero.getMainWindows()) {
			AnnotationFinder.addToWindow(win);
		}
	}
}

function shutdown() {
	for (let win of Zotero.getMainWindows()) {
		if (AnnotationFinder) AnnotationFinder.removeFromWindow(win);
	}
}
