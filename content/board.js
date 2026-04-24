if (!AnnotationFinder) {
    var AnnotationFinder = {
        init({ id, version, rootURI }) {
            this.id = id;
            this.version = version;
            this.rootURI = rootURI;

            // Register tab type for Zotero 7+
            if (Zotero.Tabs && Zotero.Tabs.registerType) {
                Zotero.Tabs.registerType({
                    type: 'annotation-finder',
                    title: 'Find annotations'
                });
            }
        },

        addToWindow(win) {
            let doc = win.document;
            const menuId = 'af-menu-v100';
            if (doc.getElementById(menuId)) return;

            const menu = doc.getElementById('menu_viewPopup') || doc.getElementById('menu_ToolsPopup');
            if (menu) {
                const mi = doc.createXULElement('menuitem');
                mi.id = menuId;
                mi.setAttribute('label', 'Find annotations');
                mi.addEventListener('command', () => this.openBoard(win));
                menu.appendChild(mi);
            }
        },

        removeFromWindow(win) {
            let el = win.document.getElementById('af-menu-v100');
            if (el) el.remove();
        },

        openBoard(win) {
            if (!win.Zotero_Tabs) return;

            let { id, container } = win.Zotero_Tabs.add({
                type: 'annotation-finder',
                title: 'Find annotations',
                data: {},
                select: true
            });

            let doc = container.ownerDocument;
            const HTML_NS = 'http://www.w3.org/1999/xhtml';
            const createEl = (tag) => doc.createElementNS(HTML_NS, tag);

            // Load external stylesheet using rootURI
            const cssUrl = this.rootURI + 'skin/default/board.css';
            if (!doc.querySelector(`link[href="${cssUrl}"]`)) {
                let link = createEl('link');
                link.rel = 'stylesheet';
                link.href = cssUrl;
                (doc.head || doc.documentElement).appendChild(link);
            }

            // Main wrapper
            let wrapper = createEl('div');
            wrapper.className = 'cs-board';

            // Header with search
            let header = createEl('div');
            header.className = 'cs-header';

            let searchRow = createEl('div');
            searchRow.className = 'cs-search-row';

            let input = createEl('input');
            input.setAttribute('type', 'search');
            input.setAttribute('placeholder', 'Find annotations');
            input.className = 'cs-search-input';

            searchRow.appendChild(input);
            header.appendChild(searchRow);
            wrapper.appendChild(header);

            // Results area
            let results = createEl('div');
            results.className = 'cs-results cs-grid';

            let placeholder = createEl('div');
            placeholder.className = 'cs-placeholder';
            results.appendChild(placeholder);
            wrapper.appendChild(results);

            container.appendChild(wrapper);

            const doSearch = async () => {
                let query = input.value.trim();
                if (!query) return;
                results.innerHTML = '';
                let loading = createEl('div');
                loading.className = 'cs-placeholder';
                loading.textContent = 'Searching…';
                results.appendChild(loading);

                try {
                    let items = await this.searchItems(query);
                    results.innerHTML = '';
                    if (items.length === 0) {
                        let empty = createEl('div');
                        empty.className = 'cs-placeholder';
                        empty.textContent = 'No results found for "' + query + '".';
                        results.appendChild(empty);
                        return;
                    }

                    let countLabel = createEl('div');
                    countLabel.className = 'cs-count';
                    countLabel.textContent = items.length + ' result' + (items.length !== 1 ? 's' : '');
                    results.appendChild(countLabel);

                    for (let item of items) {
                        let card = createEl('div');
                        card.className = 'cs-card';

                        let cardHeader = createEl('div');
                        cardHeader.className = 'cs-card-header';

                        let iconBox = createEl('div');
                        iconBox.className = 'cs-icon-box ' + (item.type === 'note' ? 'cs-icon-note' : 'cs-icon-annot');
                        iconBox.textContent = item.type === 'note' ? 'N' : 'A';
                        if (item.type === 'annotation' && item.color) {
                            iconBox.style.color = item.color;
                            iconBox.style.borderColor = item.color;
                        }
                        cardHeader.appendChild(iconBox);

                        let titleEl = createEl('span');
                        titleEl.className = 'cs-card-title-text';
                        titleEl.textContent = item.parentTitle || item.title || 'Untitled';
                        cardHeader.appendChild(titleEl);

                        if (item.type === 'annotation' && item.pageLabel) {
                            let pageTag = createEl('span');
                            pageTag.className = 'cs-page-tag';
                            pageTag.textContent = 'Page ' + item.pageLabel;
                            cardHeader.appendChild(pageTag);
                        }

                        card.appendChild(cardHeader);

                        let divider = createEl('div');
                        divider.className = 'cs-divider';
                        card.appendChild(divider);

                        let cardBody = createEl('div');
                        cardBody.className = 'cs-card-body';

                        if (item.type === 'annotation') {
                            if (item.highlight) {
                                let highlightRow = createEl('div');
                                highlightRow.className = 'cs-highlight-row';

                                let colorBar = createEl('div');
                                colorBar.className = 'cs-color-bar';
                                colorBar.style.backgroundColor = item.color || '#ff00ff';
                                highlightRow.appendChild(colorBar);

                                let highlightText = createEl('div');
                                highlightText.className = 'cs-highlight-text';
                                highlightText.textContent = item.highlight.replace(/<[^>]*>/g, '');
                                highlightRow.appendChild(highlightText);

                                cardBody.appendChild(highlightRow);
                            }

                            if (item.comment) {
                                let commentRow = createEl('div');
                                commentRow.className = 'cs-comment-row';
                                commentRow.textContent = item.comment.replace(/<[^>]*>/g, '');
                                cardBody.appendChild(commentRow);
                            }
                        } else {
                            if (item.text) {
                                let noteText = createEl('div');
                                noteText.className = 'cs-card-text-preview';
                                noteText.textContent = item.text.replace(/<[^>]*>/g, '').substring(0, 400);
                                cardBody.appendChild(noteText);
                            }
                        }

                        card.appendChild(cardBody);

                        if (item.tags && item.tags.length > 0) {
                            let tagsDiv = createEl('div');
                            tagsDiv.className = 'cs-card-tags';
                            for (let t of item.tags) {
                                let tag = createEl('span');
                                tag.className = 'cs-tag';
                                tag.textContent = t;
                                tagsDiv.appendChild(tag);
                            }
                            card.appendChild(tagsDiv);
                        }

                        card.addEventListener('click', async () => {
                            try {
                                if (item.type === 'annotation' && item.attachmentID) {
                                    // Use Zotero's native method for opening an attachment and jumping to an annotation
                                    Zotero.getMainWindow().ZoteroPane.viewAttachment(
                                        item.attachmentID, 
                                        null, 
                                        false, 
                                        { location: { annotationID: item.key } }
                                    );
                                } else {
                                    Zotero.getMainWindow().ZoteroPane.selectItem(item.id);
                                    Zotero.getMainWindow().Zotero_Tabs.select('zotero-pane');
                                }
                            } catch (e) {
                                Zotero.debug("AnnotationFinder: error navigating: " + e);
                            }
                        });
                        results.appendChild(card);
                    }
                } catch (e) {
                    results.innerHTML = '';
                    let errEl = createEl('div');
                    errEl.className = 'cs-placeholder cs-error';
                    errEl.textContent = 'Error: ' + e.message;
                    results.appendChild(errEl);
                }
            };

            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
        },

        shutdown() { },

        async searchItems(query) {
            if (!query) return [];
            let out = [];
            let seen = new Set();

            try {
                // Direct annotation and note search
                let s = new Zotero.Search();
                s.addCondition('joinMode', 'any');
                s.addCondition('annotationText', 'contains', query);
                s.addCondition('annotationComment', 'contains', query);
                s.addCondition('tag', 'contains', query);
                s.addCondition('note', 'contains', query);
                s.addCondition('title', 'contains', query); // Catches note titles
                let allIds = await s.search();

                for (let id of allIds) {
                    let item = Zotero.Items.get(id);
                    if (!item || seen.has(id)) continue;

                    if (item.isNote()) {
                        this._addNote(item, out, seen);
                    } else if (item.isAnnotation?.() || item.itemType === 'annotation') {
                        this._addAnnotation(item, out, seen);
                    }
                }
                return out;
            } catch (e) {
                Zotero.debug("AnnotationFinder: Search error: " + e);
                return [];
            }
        },

        _addAnnotation(item, out, seen) {
            if (seen.has(item.id)) return;
            seen.add(item.id);

            let parentTitle = null;
            try {
                let attachment = Zotero.Items.get(item.parentItemID);
                if (attachment) {
                    parentTitle = attachment.getDisplayTitle();
                    if (attachment.parentItemID) {
                        let topLevel = Zotero.Items.get(attachment.parentItemID);
                        if (topLevel) parentTitle = topLevel.getDisplayTitle();
                    }
                }
            } catch (e) { }

            out.push({
                id: item.id,
                key: item.key,
                attachmentID: item.parentItemID,
                type: 'annotation',
                title: parentTitle || 'Annotation',
                parentTitle: parentTitle,
                highlight: item.annotationText || '',
                comment: item.annotationComment || '',
                tags: item.getTags().map(t => t.tag),
                color: item.annotationColor || '#ff00ff',
                pageLabel: item.annotationPageLabel || ''
            });
        },

        _addNote(item, out, seen) {
            if (seen.has(item.id)) return;
            seen.add(item.id);

            let parentTitle = null;
            try {
                if (item.parentItemID) {
                    let parent = Zotero.Items.get(item.parentItemID);
                    if (parent) parentTitle = parent.getDisplayTitle();
                }
            } catch (e) { }

            out.push({
                id: item.id,
                key: item.key,
                type: 'note',
                title: item.getDisplayTitle() || 'Note',
                parentTitle: parentTitle,
                text: item.getNote() || '',
                tags: item.getTags().map(t => t.tag)
            });
        }
    };
}
