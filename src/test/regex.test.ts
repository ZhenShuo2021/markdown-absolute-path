import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	LINK_INLINE_ANGLE_RE,
	LINK_INLINE_BARE_RE,
	LINK_REFDEF_RE,
	LINK_QUOTED_RE,
	AUTOCOMPLETE_INLINE_RE,
	AUTOCOMPLETE_REFDEF_RE,
	AUTOCOMPLETE_QUOTED_RE,
} from '../helper';

function allHrefs(re: RegExp, src: string): string[] {
	const out: string[] = [];
	let m: RegExpExecArray | null;
	const r = new RegExp(re.source, re.flags);
	while ((m = r.exec(src)) !== null) {
		out.push(m.groups?.href ?? m[1] ?? m[2] ?? '');
	}
	return out;
}

function firstQuoted(src: string) {
	const r = new RegExp(LINK_QUOTED_RE.source, LINK_QUOTED_RE.flags);
	const m = r.exec(src);
	if (!m) return null;
	return { sq: m.groups?.sq, dq: m.groups?.dq };
}

describe('LINK_INLINE_BARE_RE', () => {
	const cases: { input: string; expected: string[] }[] = [
		{
			input: '請參考 [介紹頁](/docs/intro.md) 和 [FAQ](/docs/faq.md#questions) 以了解詳情。',
			expected: ['/docs/intro.md', '/docs/faq.md#questions'],
		},
		{
			input: 'Check [release notes](/changelog.md?v=2#breaking-changes) before upgrading.',
			expected: ['/changelog.md?v=2#breaking-changes'],
		},
		{
			input: '![screenshot](/assets/ui-[dark]-theme.png "Dark mode screenshot")',
			expected: ['/assets/ui-[dark]-theme.png'],
		},
		{
			input: "See [API ref](/api/v1/users.md) and [guide](/guide/step-1.md) for usage.",
			expected: ["/api/v1/users.md", '/guide/step-1.md'],
		},
		{
			input:
				'Visit [home](/index.md) — [中文說明](/zh/說明.md#第一節) — [glossary](/ref/glossary.md).',
			expected: ['/index.md', '/zh/說明.md#第一節', '/ref/glossary.md'],
		},
	];

	for (const { input, expected } of cases) {
		it(input.slice(0, 60), () => {
			assert.deepEqual(allHrefs(LINK_INLINE_BARE_RE, input), expected);
		});
	}
});

describe('LINK_INLINE_ANGLE_RE', () => {
	const cases: { input: string; expected: string[] }[] = [
		{
			input:
				'請參考 [介紹頁](</docs/intro page.md>) 和 [FAQ](</docs/faq (2024).md#questions>) 以了解詳情。',
			expected: ['/docs/intro page.md', '/docs/faq (2024).md#questions'],
		},
		{
			input: '![screenshot](</assets/ui [dark] theme.png> "Dark mode screenshot")',
			expected: ['/assets/ui [dark] theme.png'],
		},
		{
			input: 'See [changelog](</releases/v1.0 & v2.0.md#breaking changes>) for details.',
			expected: ['/releases/v1.0 & v2.0.md#breaking changes'],
		},
		{
			input: 'Visit [home](</index.md>) — [中文說明](</zh/說明 文件.md#第一節>) — done.',
			expected: ['/index.md', '/zh/說明 文件.md#第一節'],
		},
	];

	for (const { input, expected } of cases) {
		it(input.slice(0, 60), () => {
			assert.deepEqual(allHrefs(LINK_INLINE_ANGLE_RE, input), expected);
		});
	}
});

describe('LINK_REFDEF_RE', () => {
	const cases: { input: string; expected: string[] }[] = [
		{
			input: '[faq]: /docs/faq.md#questions',
			expected: ['/docs/faq.md#questions'],
		},
		{
			input: '  [release notes]: </releases/v1.0 & v2.0.md#breaking changes>',
			expected: ['/releases/v1.0 & v2.0.md#breaking changes'],
		},
		{
			input:
				'# 文件\n\n[intro]: /docs/intro.md\n[faq]: /docs/faq.md#questions\n[assets]: </assets/ui [dark] theme.png>',
			expected: ['/docs/intro.md', '/docs/faq.md#questions', '/assets/ui [dark] theme.png'],
		},
	];

	for (const { input, expected } of cases) {
		it(input.slice(0, 60), () => {
			assert.deepEqual(allHrefs(LINK_REFDEF_RE, input), expected);
		});
	}
});

describe('LINK_QUOTED_RE', () => {
	const cases: { input: string; sq?: string; dq?: string }[] = [
		{
			input: "<a href='/docs/faq.md#questions?lang=zh'>FAQ</a>",
			sq: '/docs/faq.md#questions?lang=zh',
		},
		{
			input: '<img src="/assets/ui [dark] (theme).png" alt="截圖">',
			dq: '/assets/ui [dark] (theme).png',
		},
		{
			input: "<link href='/zh/說明 文件.md#第一節'>",
			sq: '/zh/說明 文件.md#第一節',
		},
	];

	for (const { input, sq, dq } of cases) {
		it(input.slice(0, 60), () => {
			const result = firstQuoted(input);
			assert.equal(result?.sq, sq);
			assert.equal(result?.dq, dq);
		});
	}
});

describe('AUTOCOMPLETE_INLINE_RE', () => {
	const cases: { input: string; expected: string }[] = [
		{ input: '[FAQ](</docs/faq.md#que', expected: '/docs/faq.md#que' },
		{ input: '[release notes](/changelog.md?v', expected: '/changelog.md?v' },
		{ input: '![截圖](</assets/ui [dark', expected: '/assets/ui [dark' },
		{ input: '[中文說明](/zh/說明.md#第', expected: '/zh/說明.md#第' },
		{ input: '[t](', expected: '' },
	];

	for (const { input, expected } of cases) {
		it(JSON.stringify(input), () => {
			assert.equal(AUTOCOMPLETE_INLINE_RE.exec(input)?.[1], expected);
		});
	}
});

describe('AUTOCOMPLETE_REFDEF_RE', () => {
	const cases: { input: string; expected: string }[] = [
		{ input: '[faq]: /docs/faq.md#que', expected: '/docs/faq.md#que' },
		{ input: '  [中文]: /zh/說明.md#第', expected: '/zh/說明.md#第' },
		{ input: '[id]: ', expected: '' },
	];

	for (const { input, expected } of cases) {
		it(JSON.stringify(input), () => {
			assert.equal(AUTOCOMPLETE_REFDEF_RE.exec(input)?.[1], expected);
		});
	}
});

describe('AUTOCOMPLETE_QUOTED_RE', () => {
	const cases: { input: string; expected: string }[] = [
		{ input: "href='/docs/faq.md#que", expected: '/docs/faq.md#que' },
		{ input: 'src="/assets/ui [dark] (theme', expected: '/assets/ui [dark] (theme' },
		{ input: "href='/zh/說明.md?lang=zh#第", expected: '/zh/說明.md?lang=zh#第' },
	];

	for (const { input, expected } of cases) {
		it(JSON.stringify(input), () => {
			assert.equal(AUTOCOMPLETE_QUOTED_RE.exec(input)?.[1], expected);
		});
	}
});
