# Build-time XML well-formedness parser

Used only by `scripts/content.mjs` to reject malformed SVG figures before validation,
release and deployment. These files are not copied into `dist/`, the newsletter
downloads, Pages Functions, or browser JavaScript. No package installation or
network access is needed to run the parser.

- [saxes 6.0.0](https://github.com/lddubeau/saxes/tree/v6.0.0), ISC; retained in `saxes-LICENSE.txt`.
- [xmlchars 2.2.0](https://github.com/lddubeau/xmlchars/tree/v2.2.0), MIT; retained in `xmlchars-LICENSE.txt`.

Source: the exact official npm tarballs below, checked against their registry
SHA-512 integrity before extraction. The saxes npm archive omits its license;
its license text comes from the matching upstream `v6.0.0` tag.

| Tarball | SHA-512 integrity |
| --- | --- |
| https://registry.npmjs.org/saxes/-/saxes-6.0.0.tgz | `sha512-xAg7SOnEhrm5zI3puOOKyy1OMcMlIJZYNJY7xLBwSze0UjhPLnWfj2GF2EpT0jmzaJKIWKHLsaSSajf35bcYnA==` |
| https://registry.npmjs.org/xmlchars/-/xmlchars-2.2.0.tgz | `sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==` |

Local changes: renamed JavaScript files to `.cjs`, changed the three `xmlchars`
require paths in `saxes.cjs` to the local filenames, and removed source-map comments
because the maps are not included. Removed trailing spaces on three JavaScript
labels to pass the repository whitespace check. Parser behavior is otherwise unchanged.

This checks XML well-formedness and namespaces, not the SVG schema or visual
layout. The existing active/external-content checks still apply independently.
