# AeroSpot → TestFlight

## Engangssteg (manuelt, én gang)

1. App Store Connect → Apps → «+» → New App
   - Bundle ID: `com.creatorhubn.aerospot` (registrer i developer-portalen om den ikke finnes)
   - Navn: AeroSpot · Språk: Norsk (bokmål)
2. Sett credentials i shell (samme nøkler som CaptureApp bruker i CI):
   ```sh
   export APP_STORE_CONNECT_API_KEY_ID=...
   export APP_STORE_CONNECT_API_ISSUER_ID=...
   export APP_STORE_CONNECT_API_KEY_CONTENT=...   # base64 av .p8
   ```
   Alternativt: logg inn i Xcode og arkiver via Product → Archive →
   Distribute App → App Store Connect (interaktivt, enklest første gang).

## Hver utgivelse

```sh
cd ipad/AeroSpotApp
xcodegen generate
fastlane ios beta
```

Changelog til testere: legg tekst i `fastlane/changelog.txt` før kjøring.

## Verifisert lokalt

- `xcodebuild build` (simulator): SUCCEEDED
- `xcodebuild test`: 12/12 grønne
- Release-archive: kjør `fastlane ios beta` — automatic signing med team 9TAUZCPK95.
