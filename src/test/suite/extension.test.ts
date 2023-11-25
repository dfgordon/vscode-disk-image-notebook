import * as assert from 'assert';
import * as util from '../../util';

suite('util', () => {
	test('trailing_arg0', () => {
		const test_str = "good day to you sir";
		const actual = util.trailingArgWithSpaces(test_str, 0);
		const expected = "good day to you sir";
		assert.strictEqual(expected,actual);
	});
	test('trailing_arg1', () => {
		const test_str = "good day to you sir";
		const actual = util.trailingArgWithSpaces(test_str, 1);
		const expected = "day to you sir";
		assert.strictEqual(expected,actual);
	});
	test('trailing_arg2', () => {
		const test_str = "good day to you sir";
		const actual = util.trailingArgWithSpaces(test_str, 2);
		const expected = "to you sir";
		assert.strictEqual(expected,actual);
	});

	test('dotted_path_prodos_1', () => {
		const test_str = "/disk.a/wizard/spell/..";
		const actual = util.processDottedPath(test_str,"prodos","disk.a");
		const expected = "/disk.a/wizard/";
		assert.strictEqual(expected,actual);
	});
	test('dotted_path_prodos_1a', () => {
		const test_str = "/disk.a/wizard/spell/../";
		const actual = util.processDottedPath(test_str,"prodos","disk.a");
		const expected = "/disk.a/wizard/";
		assert.strictEqual(expected,actual);
	});
	test('dotted_path_prodos_2', () => {
		const test_str = "/disk.a/..";
		const actual = util.processDottedPath(test_str,"prodos","disk.a");
		const expected = "/disk.a/";
		assert.strictEqual(expected,actual);
	});
	test('dotted_path_msdos_1', () => {
		const test_str = "/wizard/spell/..";
		const actual = util.processDottedPath(test_str,"fat","disk.a");
		const expected = "/wizard/";
		assert.strictEqual(expected,actual);
	});
	test('dotted_path_msdos_2', () => {
		const test_str = "/..";
		const actual = util.processDottedPath(test_str,"fat","disk.a");
		const expected = "/";
		assert.strictEqual(expected,actual);
	});
});
