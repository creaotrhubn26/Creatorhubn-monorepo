fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios bump_build

```sh
[bundle exec] fastlane ios bump_build
```

Bump CFBundleVersion by 1

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Archive + upload til TestFlight

### ios staging_beta

```sh
[bundle exec] fastlane ios staging_beta
```

Archive + upload a staging-connected build to TestFlight

### ios release

```sh
[bundle exec] fastlane ios release
```

Archive + submit for App Store Review

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
