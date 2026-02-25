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

                        card.addEventListener('click', () => {
                            try {
                                if (item.type === 'annotation' && item.attachmentID) {
                                    Zotero.Reader.open(item.attachmentID, 0, { annotationKey: item.key });
                                } else {
                                    Zotero.getMainWindow().ZoteroPane.selectItem(item.id);
                                    Zotero.getMainWindow().Zotero_Tabs.select('zotero-pane');
                                }
                            } catch (e) {
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
            let lowerQuery = query.toLowerCase();

            try {
                // 1) Quicksearch
                let s = new Zotero.Search();
                s.addCondition('quicksearch-fields', 'contains', query);
                let ids = await s.search();

                // 2) Direct annotation search
                let s2 = new Zotero.Search();
                s2.addCondition('joinMode', 'any');
                s2.addCondition('annotationText', 'contains', query);
                s2.addCondition('annotationComment', 'contains', query);
                s2.addCondition('tag', 'contains', query);
                let annotIds = await s2.search();

                let allIds = [...new Set([...ids, ...annotIds])];

                for (let id of allIds) {
                    let item = Zotero.Items.get(id);
                    if (!item || seen.has(id)) continue;

                    // Support both isAnnotation() and itemType check
                    const isAnnot = (item.isAnnotation && item.isAnnotation()) || item.itemType === 'annotation';

                    // Notes
                    if (item.isNote()) {
                        seen.add(id);
                        let parentTitle = null;
                        if (item.parentItemID) {
                            let parent = Zotero.Items.get(item.parentItemID);
                            if (parent) parentTitle = parent.getDisplayTitle();
                        }
                        out.push({
                            id: item.id,
                            type: 'note',
                            title: item.getNoteTitle() || 'Untitled Note',
                            parentTitle: parentTitle,
                            text: item.getNote() || '',
                            tags: item.getTags().map(t => t.tag)
                        });
                    }
                    // Annotations
                    else if (isAnnot) {
                        this._addAnnotation(item, out, seen);
                    }
                    // Attachments — check child annotations
                    else if (item.isAttachment && item.isAttachment()) {
                        this._collectChildAnnotations(item, query, lowerQuery, out, seen);
                    }
                    // Regular items — check child notes + search attachments
                    else if (item.isRegularItem && item.isRegularItem()) {
                        // Child notes
                        let noteIDs = item.getNotes();
                        for (let noteID of noteIDs) {
                            if (seen.has(noteID)) continue;
                            let note = Zotero.Items.get(noteID);
                            if (!note) continue;
                            let noteContent = note.getNote() || '';
                            let noteTitle = note.getNoteTitle() || 'Untitled Note';
                            let stripped = noteContent.replace(/<[^>]*>/g, '').toLowerCase();
                            if (stripped.includes(lowerQuery) || noteTitle.toLowerCase().includes(lowerQuery)) {
                                seen.add(noteID);
                                out.push({
                                    id: note.id,
                                    type: 'note',
                                    title: noteTitle,
                                    parentTitle: item.getDisplayTitle(),
                                    text: noteContent,
                                    tags: note.getTags().map(t => t.tag)
                                });
                            }
                        }
                        // Child attachments
                        let attIDs = item.getAttachments();
                        for (let attID of attIDs) {
                            let att = Zotero.Items.get(attID);
                            if (att) this._collectChildAnnotations(att, query, lowerQuery, out, seen);
                        }
                    }
                }
                return out;
                
            } catch (e) {
                Zotero.debug("AnnotationFinder: Search error: " + e);
                return [];
            }
        },

        // Extract a single annotation item into a result entry
        _addAnnotation(item, out, seen) {
            if (seen.has(item.id)) return;
            seen.add(item.id);

            let parentTitle = null;
            try {
                let attachment = Zotero.Items.get(item.parentItemID);
                if (attachment && attachment.parentItemID) {
                    let topLevel = Zotero.Items.get(attachment.parentItemID);
                    if (topLevel) parentTitle = topLevel.getDisplayTitle();
                } else if (attachment) {
                    parentTitle = attachment.getDisplayTitle();
                }
            } catch (e) { }

            let highlight = '';
            let comment = '';
            try {
                highlight = (item.getField ? item.getField('annotationText') : null) || item.annotationText || '';
                comment = (item.getField ? item.getField('annotationComment') : null) || item.annotationComment || '';
            } catch (e) {
                highlight = item.annotationText || '';
                comment = item.annotationComment || '';
            }

            out.push({
                id: item.id,
                key: item.key,
                attachmentID: item.parentItemID,
                type: 'annotation',
                title: parentTitle || 'Annotation',
                parentTitle: parentTitle,
                highlight: highlight,
                comment: comment,
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
                text: item.getNote(),
                tags: item.getTags().map(t => t.tag)
            });
        },

        // Walk child annotations of an attachment and add matches
        _collectChildAnnotations(attachment, query, lowerQuery, out, seen) {
            try {
                let annotIDs = attachment.getAnnotations ? attachment.getAnnotations() : [];
                for (let annot of annotIDs) {
                    let annotItem = typeof annot === 'number' ? Zotero.Items.get(annot) : annot;
                    if (!annotItem || seen.has(annotItem.id)) continue;

                    let text = ((annotItem.getField ? annotItem.getField('annotationText') : null) || annotItem.annotationText || '').toLowerCase();
                    let comment = ((annotItem.getField ? annotItem.getField('annotationComment') : null) || annotItem.annotationComment || '').toLowerCase();
                    let hasTag = annotItem.getTags().some(t => t.tag.toLowerCase().includes(lowerQuery));

                    if (text.includes(lowerQuery) || comment.includes(lowerQuery) || hasTag) {
                        this._addAnnotation(annotItem, out, seen);
                    }
                }
            } catch (e) {
                Zotero.debug("AnnotationFinder: Error scanning annotations: " + e);
            }
        }
    };
}
