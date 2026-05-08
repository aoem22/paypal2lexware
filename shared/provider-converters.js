/* Bank2Lexware provider converters for Wise and Stripe CSV exports. */

(function () {
    var config = window.B2L_PROVIDER || {};
    var rawCSVData = [];
    var sourceFileCount = 0;
    var duplicateRowCount = 0;

    function normalizeKey(key) {
        return String(key || '')
            .toLowerCase()
            .replace(/^\uFEFF/, '')
            .replace(/[_\-./()]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getVal(row) {
        var aliases = Array.prototype.slice.call(arguments, 1);
        var rowKeys = Object.keys(row || {}).filter(function (key) { return key.indexOf('__b2l') !== 0; });
        var normalized = rowKeys.map(function (key) {
            return { original: key, normalized: normalizeKey(key) };
        });

        for (var i = 0; i < aliases.length; i++) {
            var alias = normalizeKey(aliases[i]);
            var exact = normalized.find(function (item) { return item.normalized === alias; });
            if (exact && row[exact.original] !== undefined && String(row[exact.original]).trim() !== '') {
                return String(row[exact.original]).trim();
            }
        }

        for (var j = 0; j < aliases.length; j++) {
            var fuzzy = normalizeKey(aliases[j]);
            var match = normalized.find(function (item) {
                return item.normalized.indexOf(fuzzy) !== -1 || fuzzy.indexOf(item.normalized) !== -1;
            });
            if (match && row[match.original] !== undefined && String(row[match.original]).trim() !== '') {
                return String(row[match.original]).trim();
            }
        }

        return '';
    }

    function getExactVal(row) {
        var aliases = Array.prototype.slice.call(arguments, 1);
        var rowKeys = Object.keys(row || {}).filter(function (key) { return key.indexOf('__b2l') !== 0; });
        var normalized = rowKeys.map(function (key) {
            return { original: key, normalized: normalizeKey(key) };
        });

        for (var i = 0; i < aliases.length; i++) {
            var alias = normalizeKey(aliases[i]);
            var exact = normalized.find(function (item) { return item.normalized === alias; });
            if (exact && row[exact.original] !== undefined && String(row[exact.original]).trim() !== '') {
                return String(row[exact.original]).trim();
            }
        }

        return '';
    }

    function parseAmount(value) {
        if (value === null || value === undefined) return null;

        var raw = String(value).trim();
        if (!raw || raw === '-' || raw.toLowerCase() === 'null') return null;

        var negative = false;
        if (/^\(.*\)$/.test(raw)) {
            negative = true;
            raw = raw.slice(1, -1);
        }
        if (/^[−-]/.test(raw)) {
            negative = true;
        }

        raw = raw
            .replace(/[^\d,.\-−]/g, '')
            .replace(/[−-]/g, '');

        if (!raw) return null;

        var lastComma = raw.lastIndexOf(',');
        var lastDot = raw.lastIndexOf('.');
        var decimalSeparator = null;

        if (lastComma !== -1 && lastDot !== -1) {
            decimalSeparator = lastComma > lastDot ? ',' : '.';
        } else if (lastComma !== -1) {
            decimalSeparator = raw.length - lastComma <= 3 ? ',' : null;
        } else if (lastDot !== -1) {
            decimalSeparator = raw.length - lastDot <= 3 ? '.' : null;
        }

        if (decimalSeparator === ',') {
            raw = raw.replace(/\./g, '').replace(',', '.');
        } else if (decimalSeparator === '.') {
            raw = raw.replace(/,/g, '');
        } else {
            raw = raw.replace(/[,.]/g, '');
        }

        var parsed = parseFloat(raw);
        if (isNaN(parsed)) return null;
        return negative ? -parsed : parsed;
    }

    function toGermanAmount(value) {
        var rounded = Math.round((value + Number.EPSILON) * 100) / 100;
        return rounded.toFixed(2).replace('.', ',');
    }

    function parseDate(value) {
        if (!value) return null;

        var raw = String(value).trim();
        if (!raw) return null;

        var isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return {
                iso: isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3],
                german: isoMatch[3] + '.' + isoMatch[2] + '.' + isoMatch[1]
            };
        }

        var germanMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (germanMatch) {
            var gd = germanMatch[1].padStart(2, '0');
            var gm = germanMatch[2].padStart(2, '0');
            return {
                iso: germanMatch[3] + '-' + gm + '-' + gd,
                german: gd + '.' + gm + '.' + germanMatch[3]
            };
        }

        var slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (slashMatch) {
            var first = parseInt(slashMatch[1], 10);
            var second = parseInt(slashMatch[2], 10);
            var year = slashMatch[3].length === 2 ? '20' + slashMatch[3] : slashMatch[3];
            var month = first > 12 ? second : first;
            var day = first > 12 ? first : second;
            var sm = String(month).padStart(2, '0');
            var sd = String(day).padStart(2, '0');
            return {
                iso: year + '-' + sm + '-' + sd,
                german: sd + '.' + sm + '.' + year
            };
        }

        var date = new Date(raw);
        if (!isNaN(date.getTime())) {
            var yyyy = String(date.getFullYear());
            var mm = String(date.getMonth() + 1).padStart(2, '0');
            var dd = String(date.getDate()).padStart(2, '0');
            return { iso: yyyy + '-' + mm + '-' + dd, german: dd + '.' + mm + '.' + yyyy };
        }

        return null;
    }

    function sanitizeCSVField(field) {
        return String(field || '')
            .replace(/;/g, ',')
            .replace(/"/g, '')
            .replace(/[\r\n]+/g, ' ')
            .trim();
    }

    function escapeHTML(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildPurpose(parts) {
        return parts
            .filter(function (part) { return part !== null && part !== undefined && String(part).trim() !== ''; })
            .map(function (part) { return String(part).trim(); })
            .join(' | ')
            .slice(0, 240) || 'Keine Angabe';
    }

    function compactLabel(value, fallback) {
        var label = String(value || '').trim();
        return label || fallback || 'Keine Angabe';
    }

    function providerNote(currency, reference) {
        var parts = [];
        if (currency && currency.toUpperCase() !== 'EUR') parts.push(currency.toUpperCase());
        if (reference) parts.push(reference);
        return parts.length ? parts.join(' / ') : '';
    }

    function joinUnique(parts) {
        var seen = {};
        return parts
            .filter(function (part) { return part !== null && part !== undefined && String(part).trim() !== ''; })
            .map(function (part) { return String(part).trim(); })
            .filter(function (part) {
                var key = normalizeKey(part);
                if (seen[key]) return false;
                seen[key] = true;
                return true;
            })
            .join(' / ');
    }

    function closeEnough(a, b) {
        return Math.abs(a - b) < 0.015;
    }

    function getStripeDateValue(row) {
        return getVal(
            row,
            'created_utc',
            'created',
            'Created (UTC)',
            'available_on_utc',
            'effective_at_utc',
            'automatic_payout_effective_at_utc',
            'payout_effective_at_utc',
            'balance_transaction_created',
            'Balance transaction created',
            'Date'
        );
    }

    function isStripeFeeCategory(categoryLower) {
        return categoryLower === 'fee' ||
            categoryLower.indexOf(' fee') !== -1 ||
            categoryLower.indexOf('fees') !== -1 ||
            categoryLower.indexOf('stripe fee') !== -1;
    }

    function isStripeNonMovementSummary(categoryLower, descriptionLower) {
        return categoryLower === 'starting balance' ||
            categoryLower === 'ending balance' ||
            descriptionLower.indexOf('starting balance') === 0 ||
            descriptionLower.indexOf('ending balance') === 0;
    }

    function stripePurposePrefix(categoryLower) {
        if (isStripeFeeCategory(categoryLower)) return 'Stripe-Gebühr';
        if (categoryLower.indexOf('payout') !== -1) return 'Stripe-Auszahlung';
        if (categoryLower.indexOf('refund') !== -1) return 'Stripe-Rückerstattung';
        if (categoryLower.indexOf('dispute') !== -1) return 'Stripe-Dispute';
        if (categoryLower.indexOf('charge') !== -1 || categoryLower.indexOf('payment') !== -1) return 'Stripe-Zahlung';
        if (categoryLower.indexOf('transfer') !== -1) return 'Stripe-Transfer';
        if (categoryLower.indexOf('adjustment') !== -1) return 'Stripe-Anpassung';
        return 'Stripe-Transaktion';
    }

    function stripeCounterparty(categoryLower, customer, sourceId) {
        if (isStripeFeeCategory(categoryLower)) return 'Stripe';
        if (categoryLower.indexOf('payout') !== -1) return 'Stripe Auszahlung';
        if (categoryLower.indexOf('transfer') !== -1) return 'Stripe Transfer';
        return compactLabel(customer || sourceId, 'Stripe');
    }

    function normalizeStripeFeeAmount(gross, net, fee) {
        if (fee === null || Math.abs(fee) < 0.005) return null;

        if (gross !== null && net !== null) {
            if (closeEnough(gross + fee, net)) return fee;
            if (closeEnough(gross - fee, net)) return -fee;
        }

        return fee > 0 ? -Math.abs(fee) : fee;
    }

    function getStripeDedupeKey(row) {
        var transactionId = getExactVal(
            row,
            'balance_transaction_id',
            'Balance transaction ID',
            'balance_transaction',
            'Balance transaction',
            'id',
            'ID'
        );
        if (transactionId) return 'balance:' + normalizeKey(transactionId);

        var sourceId = getVal(
            row,
            'source_id',
            'Source ID',
            'charge_id',
            'Charge ID',
            'payment_intent_id',
            'Payment Intent ID',
            'payout_id',
            'Payout ID',
            'refund_id',
            'Refund ID',
            'dispute_id',
            'Dispute ID',
            'source',
            'Source'
        );
        var dateInfo = parseDate(getStripeDateValue(row));
        if (!sourceId || !dateInfo) return '';

        return [
            'source',
            normalizeKey(sourceId),
            dateInfo.iso,
            normalizeKey(getVal(row, 'reporting_category', 'Reporting category', 'category', 'Category', 'type', 'Type')),
            getVal(row, 'gross', 'Gross', 'amount', 'Amount', 'net_amount', 'Net amount'),
            getVal(row, 'fee', 'Fee', 'fees', 'Fees')
        ].join('|');
    }

    function normalizeWiseRow(row) {
        var dateInfo = parseDate(getVal(row, 'Date', 'Created on', 'Created', 'Time', 'Transaction Date', 'transactions.date'));
        if (!dateInfo) return [];

        var type = getVal(row, 'Type', 'Transaction type', 'Details type', 'details.type');
        var currency = getVal(row, 'Currency', 'Amount currency', 'amount.currency', 'Balance currency');
        var reference = getVal(row, 'Reference number', 'referenceNumber', 'Reference', 'ID');
        var merchant = getVal(row, 'Merchant', 'Merchant name', 'details.merchant.name');
        var counterparty = getVal(row, 'Sender name', 'Recipient name', 'Name', 'Counterparty', 'Payee', 'Payer');
        var description = getVal(row, 'Description', 'Details', 'Payment reference', 'details.description', 'details.paymentReference', 'Narrative');
        var amount = parseAmount(getVal(row, 'Amount', 'Amount value', 'Transaction amount', 'amount.value', 'Net amount', 'Value'));
        var debit = parseAmount(getVal(row, 'Debit', 'Paid out', 'Money out'));
        var credit = parseAmount(getVal(row, 'Credit', 'Paid in', 'Money in'));

        if (amount === null) {
            if (credit !== null) amount = Math.abs(credit);
            if (debit !== null) amount = -Math.abs(debit);
        }
        if (amount === null || amount === 0) return [];

        var fee = parseAmount(getVal(row, 'Total fees', 'Total fee', 'Fees', 'Fee', 'transactions.totalFees.value'));
        var typeLower = normalizeKey(type);
        var name = compactLabel(merchant || counterparty, 'Wise');
        var note = providerNote(currency, reference);
        var purpose = buildPurpose([description || type || 'Wise Transaktion', note]);
        var rows = [];

        if (fee && fee > 0 && amount < 0 && typeLower.indexOf('fee') === -1 && typeLower.indexOf('charge') === -1) {
            var baseAmount = amount + Math.abs(fee);
            if (Math.abs(baseAmount) >= 0.005) {
                rows.push({
                    'Datum': dateInfo.german,
                    'Auftraggeber/Empfänger': name,
                    'Verwendungszweck': purpose,
                    'Betrag': toGermanAmount(baseAmount)
                });
            }
            rows.push({
                'Datum': dateInfo.german,
                'Auftraggeber/Empfänger': 'Wise',
                'Verwendungszweck': buildPurpose(['Wise-Gebühr zu ' + compactLabel(description || type, 'Transaktion'), note]),
                'Betrag': toGermanAmount(-Math.abs(fee))
            });
            return rows;
        }

        rows.push({
            'Datum': dateInfo.german,
            'Auftraggeber/Empfänger': name,
            'Verwendungszweck': purpose,
            'Betrag': toGermanAmount(amount)
        });
        return rows;
    }

    function normalizeStripeRow(row) {
        var dateInfo = parseDate(getStripeDateValue(row));
        if (!dateInfo) return [];

        var category = getVal(row, 'reporting_category', 'Reporting category', 'category', 'Category', 'type', 'Type');
        var currency = getVal(row, 'currency', 'Currency');
        var transactionId = getExactVal(row, 'balance_transaction_id', 'Balance transaction ID', 'balance_transaction', 'Balance transaction', 'id', 'ID');
        var sourceId = getVal(
            row,
            'source_id',
            'Source ID',
            'charge_id',
            'Charge ID',
            'payment_intent_id',
            'Payment Intent ID',
            'invoice_id',
            'Invoice ID',
            'payout_id',
            'Payout ID',
            'refund_id',
            'Refund ID',
            'dispute_id',
            'Dispute ID',
            'source',
            'Source'
        );
        var traceId = getVal(row, 'trace_id', 'Trace ID');
        var customer = getVal(
            row,
            'customer_name',
            'Customer name',
            'customer_description',
            'Customer description',
            'customer_email',
            'Customer email',
            'buyer_email',
            'Buyer email',
            'card_name',
            'Card name'
        );
        var description = getVal(
            row,
            'description',
            'Description',
            'payout_description',
            'Payout description',
            'statement_descriptor',
            'Statement descriptor',
            'invoice_number',
            'Invoice number'
        );
        var gross = parseAmount(getVal(row, 'gross', 'Gross', 'amount', 'Amount', 'net_amount', 'Net amount'));
        var net = parseAmount(getVal(row, 'net', 'Net', 'net_amount', 'Net amount'));
        var fee = parseAmount(getVal(row, 'fee', 'Fee', 'fees', 'Fees', 'stripe_fee', 'Stripe fee'));
        var rows = [];
        var categoryLower = normalizeKey(category);
        var descriptionLower = normalizeKey(description);
        if (isStripeNonMovementSummary(categoryLower, descriptionLower)) return [];

        var isFeeCategory = isStripeFeeCategory(categoryLower);
        var prefix = stripePurposePrefix(categoryLower);
        var name = stripeCounterparty(categoryLower, customer, sourceId);
        var reference = joinUnique([transactionId, sourceId, traceId]);
        var note = providerNote(currency, reference);
        var amount = gross;

        if ((amount === null || amount === 0) && !isFeeCategory && net !== null) amount = net;
        if ((amount === null || amount === 0) && isFeeCategory) {
            if (net !== null && net !== 0) {
                amount = net;
            } else if (fee !== null && fee !== 0) {
                amount = fee > 0 ? -Math.abs(fee) : fee;
            }
        }
        if (isFeeCategory && amount !== null && amount > 0 && categoryLower.indexOf('refund') === -1) {
            amount = -Math.abs(amount);
        }
        if (amount === null || Math.abs(amount) < 0.005) return [];

        var purpose = buildPurpose([prefix + ': ' + compactLabel(description || category, 'Stripe'), note]);

        rows.push({
            'Datum': dateInfo.german,
            'Auftraggeber/Empfänger': name,
            'Verwendungszweck': purpose,
            'Betrag': toGermanAmount(amount)
        });

        var feeAmount = normalizeStripeFeeAmount(gross, net, fee);
        if (feeAmount !== null && !isFeeCategory) {
            rows.push({
                'Datum': dateInfo.german,
                'Auftraggeber/Empfänger': 'Stripe',
                'Verwendungszweck': buildPurpose(['Stripe-Gebühr zu ' + compactLabel(description || category, 'Transaktion'), note]),
                'Betrag': toGermanAmount(feeAmount)
            });
        }

        return rows;
    }

    function detectHeaderIndex(text) {
        var lines = text.split(/\r?\n/);
        var required = config.headerNeedles || ['date', 'amount'];
        var anyNeedles = config.headerAnyNeedles || [];
        var anyNeedleMin = config.headerAnyNeedleMin || 2;

        for (var i = 0; i < lines.length; i++) {
            var line = normalizeKey(lines[i]);
            var requiredMatches = !required.length || required.every(function (needle) {
                return line.indexOf(normalizeKey(needle)) !== -1;
            });
            var anyMatches = !anyNeedles.length || anyNeedles.filter(function (needle) {
                return line.indexOf(normalizeKey(needle)) !== -1;
            }).length >= anyNeedleMin;
            if (requiredMatches && anyMatches) return i;
        }

        return 0;
    }

    function renderConversionDetails(rows) {
        var tbody = document.getElementById('conversion-table-body');
        tbody.innerHTML = '';

        if (!rows.length) {
            var empty = document.createElement('tr');
            empty.innerHTML = '<td colspan="4" class="px-4 py-3 text-center text-gray-500">Keine Buchungen gefunden.</td>';
            tbody.appendChild(empty);
            return;
        }

        rows.slice(0, 50).forEach(function (row) {
            var tr = document.createElement('tr');
            var betrag = row['Betrag'] || '';
            var isNegative = betrag.indexOf('-') === 0;
            var betragClass = isNegative ? 'text-red-600 font-medium' : 'text-green-600 font-medium';
            var party = sanitizeCSVField(row['Auftraggeber/Empfänger']);
            var purpose = sanitizeCSVField(row['Verwendungszweck']);
            tr.className = 'bg-white hover:bg-gray-50 transition-colors';
            tr.innerHTML =
                '<td class="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">' + escapeHTML(row['Datum'] || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="' + escapeHTML(party) + '">' + escapeHTML(party || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 max-w-sm truncate" title="' + escapeHTML(purpose) + '">' + escapeHTML(purpose || '-') + '</td>' +
                '<td class="px-4 py-3 text-right ' + betragClass + '">' + escapeHTML(betrag || '-') + '</td>';
            tbody.appendChild(tr);
        });

        if (rows.length > 50) {
            var more = document.createElement('tr');
            more.innerHTML = '<td colspan="4" class="px-4 py-3 text-center text-gray-500 italic">... und ' + (rows.length - 50) + ' weitere Buchungen</td>';
            tbody.appendChild(more);
        }
    }

    function showDateSelection(data) {
        var minDate = null;
        var maxDate = null;

        data.forEach(function (row) {
            var dateValue = config.provider === 'stripe'
                ? getStripeDateValue(row)
                : getVal(row, 'Date', 'Created on', 'Created', 'Time', 'Transaction Date', 'transactions.date');
            var dateInfo = parseDate(dateValue);
            if (dateInfo) {
                if (!minDate || dateInfo.iso < minDate) minDate = dateInfo.iso;
                if (!maxDate || dateInfo.iso > maxDate) maxDate = dateInfo.iso;
            }
        });

        if (minDate && maxDate) {
            document.getElementById('startDate').value = minDate;
            document.getElementById('endDate').value = maxDate;
            document.getElementById('startDate').min = minDate;
            document.getElementById('startDate').max = maxDate;
            document.getElementById('endDate').min = minDate;
            document.getElementById('endDate').max = maxDate;
        }

        document.getElementById('date-selection-container').classList.remove('hidden');
        startConversion();
    }

    function startConversion() {
        var startDate = document.getElementById('startDate').value;
        var endDate = document.getElementById('endDate').value;

        document.getElementById('status').classList.add('hidden');
        document.getElementById('loading-indicator').classList.remove('hidden');
        startProgress();

        var normalizer = config.provider === 'stripe' ? normalizeStripeRow : normalizeWiseRow;
        var outputRows = [];
        var skipped = 0;

        duplicateRowCount = 0;
        var seenStripeRows = {};

        rawCSVData.forEach(function (row) {
            if (config.provider === 'stripe') {
                var dedupeKey = getStripeDedupeKey(row);
                if (dedupeKey && seenStripeRows[dedupeKey]) {
                    duplicateRowCount++;
                    return;
                }
                if (dedupeKey) seenStripeRows[dedupeKey] = true;
            }

            var normalizedRows = normalizer(row);
            if (!normalizedRows.length) {
                skipped++;
                return;
            }

            normalizedRows.forEach(function (converted) {
                var dateInfo = parseDate(converted['Datum']);
                if (!dateInfo) return;
                if (startDate && dateInfo.iso < startDate) return;
                if (endDate && dateInfo.iso > endDate) return;
                outputRows.push(converted);
            });
        });

        outputRows.sort(function (a, b) {
            var aDate = parseDate(a['Datum']);
            var bDate = parseDate(b['Datum']);
            var aIso = aDate ? aDate.iso : '';
            var bIso = bDate ? bDate.iso : '';
            return aIso.localeCompare(bIso);
        });

        if (!outputRows.length) {
            showError('Keine gültigen Transaktionen im ausgewählten Zeitraum gefunden.');
            stopProgress();
            return;
        }

        var header = 'Datum;Auftraggeber/Empfänger;Verwendungszweck;Betrag';
        var lines = outputRows.map(function (row) {
            return [
                row['Datum'],
                sanitizeCSVField(row['Auftraggeber/Empfänger']),
                sanitizeCSVField(row['Verwendungszweck']),
                row['Betrag']
            ].join(';');
        });
        var csvContent = header + '\n' + lines.join('\n');
        var utf8Bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        var blob = new Blob([utf8Bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var downloadLink = document.getElementById('downloadLink');
        var firstDate = parseDate(outputRows[0]['Datum']);
        var lastDate = parseDate(outputRows[outputRows.length - 1]['Datum']);
        var filenameDatePart = firstDate && lastDate
            ? (firstDate.iso === lastDate.iso ? firstDate.iso : firstDate.iso + '_bis_' + lastDate.iso)
            : 'export';

        downloadLink.href = url;
        downloadLink.download = (config.outputPrefix || config.provider || 'provider') + '_' + filenameDatePart + '_lexware_import.csv';

        completeProgress();
        setTimeout(function () {
            document.getElementById('download-area').classList.remove('hidden');
            document.getElementById('loading-indicator').classList.add('hidden');

            var statusMsg = outputRows.length + ' Buchungszeilen erfolgreich konvertiert.';
            if (sourceFileCount > 1) statusMsg += ' Aus ' + sourceFileCount + ' CSV-Dateien zusammengeführt.';
            if (duplicateRowCount > 0) statusMsg += ' ' + duplicateRowCount + ' doppelte Stripe-Zeilen übersprungen.';
            if (skipped > 0) statusMsg += ' (' + skipped + ' Zeilen ohne Datum/Betrag übersprungen)';
            showStatus(statusMsg, 'success');
            renderConversionDetails(outputRows);
        }, 300);
    }

    function readCSVFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (event) {
                var text = event.target.result || '';
                var headerIndex = detectHeaderIndex(text);
                var csvContent = text.split(/\r?\n/).slice(headerIndex).join('\n');

                Papa.parse(csvContent, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function (results) {
                        if (results.errors.length > 0 && results.data.length === 0) {
                            reject(new Error('Fehler beim Lesen von ' + file.name + ': ' + results.errors[0].message));
                            return;
                        }
                        resolve(results.data.map(function (row) {
                            row.__b2lSourceFile = file.name;
                            return row;
                        }));
                    },
                    error: function (err) {
                        reject(new Error('Parsing Fehler in ' + file.name + ': ' + err.message));
                    }
                });
            };
            reader.onerror = function () {
                reject(new Error('Datei konnte nicht gelesen werden: ' + file.name));
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    function parseFiles(files) {
        var selectedFiles = Array.prototype.slice.call(files || []);
        if (!selectedFiles.length) return;
        if (!config.allowMultiple) selectedFiles = selectedFiles.slice(0, 1);

        sourceFileCount = selectedFiles.length;
        if (sourceFileCount > 1) {
            showStatus('Lese ' + sourceFileCount + ' CSV-Dateien...');
        }

        Promise.all(selectedFiles.map(readCSVFile))
            .then(function (chunks) {
                rawCSVData = chunks.reduce(function (allRows, rows) {
                    return allRows.concat(rows);
                }, []);
                if (!rawCSVData.length) {
                    showError('Keine CSV-Zeilen gefunden.');
                    return;
                }
                showDateSelection(rawCSVData);
            })
            .catch(function (err) {
                showError(err.message);
            });
    }

    function parseCSV(file) {
        parseFiles([file]);
    }

    window.startConversion = startConversion;

    var dropZone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('fileInput');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', function () { fileInput.click(); });
        dropZone.addEventListener('dragover', function (event) {
            event.preventDefault();
            dropZone.classList.add(config.dragBorderClass || 'border-[#003087]', config.dragBgClass || 'bg-blue-50/30');
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove(config.dragBorderClass || 'border-[#003087]', config.dragBgClass || 'bg-blue-50/30');
        });
        dropZone.addEventListener('drop', function (event) {
            event.preventDefault();
            dropZone.classList.remove(config.dragBorderClass || 'border-[#003087]', config.dragBgClass || 'bg-blue-50/30');
            if (event.dataTransfer.files.length) {
                resetUI();
                parseFiles(event.dataTransfer.files);
            }
        });
        fileInput.addEventListener('change', function (event) {
            if (event.target.files.length) {
                resetUI();
                parseFiles(event.target.files);
            }
        });
    }
})();
