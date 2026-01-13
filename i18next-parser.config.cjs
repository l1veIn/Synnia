module.exports = {
    defaultNamespace: 'common',
    lexers: {
        ts: ['JavascriptLexer'],
        tsx: ['JsxLexer'],
        js: ['JavascriptLexer'],
        jsx: ['JsxLexer'],
    },
    locales: ['en', 'zh'],
    output: 'src/locales/$LOCALE/$NAMESPACE.json',
    input: ['src/**/*.{ts,tsx}'],
    keepRemoved: false,
    createOldCatalogs: false,
    sort: true,
    namespaceSeparator: false,
    keySeparator: '.',
    defaultValue: (locale, namespace, key) => {
        // Return the key itself as placeholder for missing translations
        return key;
    },
};
