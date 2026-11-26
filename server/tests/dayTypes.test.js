import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_DAY_TYPES_CONFIG } from '../constants/dayTypes.js';
import { resolveDayCell, setDayTypesConfig } from '../../client/src/utils/dayTypes.js';

const fmt = (n) => `$${n / 1000}k`;

describe('Server-driven day types (Payment Summary cells)', () => {
    beforeEach(() => setDayTypesConfig(DEFAULT_DAY_TYPES_CONFIG));

    it('keeps the previous rendering for every dayType', () => {
        assert.deepEqual(resolveDayCell({ dayType: 'LOAN', totalPaid: 30000 }, fmt), { cellClass: 'status-cell loand', content: '--' });
        assert.deepEqual(resolveDayCell({ dayType: 'PAID', totalPaid: 30000 }, fmt), { cellClass: 'status-cell approved', content: '$30k' });
        assert.deepEqual(resolveDayCell({ dayType: 'PAID', totalPaid: 0 }, fmt), { cellClass: 'status-cell approved', content: '✓' });
        assert.deepEqual(resolveDayCell({ dayType: 'FREE', totalPaid: 0 }, fmt), { cellClass: 'status-cell free', content: '✓' });
        assert.deepEqual(resolveDayCell({ dayType: 'ADJUSTMENT', totalPaid: 0 }, fmt), { cellClass: 'status-cell adjusted', content: '🔧' });
        assert.deepEqual(resolveDayCell({ dayType: 'ADJUSTMENT', totalPaid: 5000 }, fmt), { cellClass: 'status-cell adjusted', content: '$5k' });
        assert.deepEqual(resolveDayCell({ dayType: 'DEBT', totalPaid: 0 }, fmt), { cellClass: 'status-cell pending', content: '-' });
        assert.deepEqual(resolveDayCell(null, fmt), { cellClass: 'status-cell empty', content: '--' });
    });

    it('lets the server override a dayType and ignores invalid payloads', () => {
        setDayTypesConfig({ FREE: { cellClass: 'status-cell gift', defaultText: '🎁', renderMode: 'static' } });
        assert.deepEqual(resolveDayCell({ dayType: 'FREE', totalPaid: 9000 }, fmt), { cellClass: 'status-cell gift', content: '🎁' });
        setDayTypesConfig(undefined);
        assert.equal(resolveDayCell({ dayType: 'FREE' }, fmt).content, '🎁');
    });

    it('nightly curfew jobs filter by exemptFromCurfew, not exemptFromCutOff', async () => {
        for (const job of ['performCurfewStart.js', 'performCurfewEnd.js']) {
            const src = await readFile(new URL(`../cron-server/jobs/${job}`, import.meta.url), 'utf8');
            assert.match(src, /exemptFromCurfew:\s*\{\s*\$ne:\s*true\s*\}/, job);
            assert.doesNotMatch(src, /exemptFromCutOff/, job);
        }
    });
});
