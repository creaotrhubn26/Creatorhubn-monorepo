import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Film-finish korn. Research (Mastin/RNI/VSCO): ekte film-korn er organisk og
/// FINT for moderne emulsjoner (T-korn), litt grovere for vintage; det er en av
/// de mest taktile «film»-tellene sammen med myk høylys-skulder. Vi legger et
/// dempet monokromt korn som soft-light-blandes (nøytralt ved 0.5 → bevarer
/// eksponering), amplitude skalert av `recipe.filmGrain`.
///
/// No-op når `recipe.filmGrain <= 0`. Deterministisk (CIRandomGenerator gir et
/// fast mønster) → egnet for seek-drevet render + testbart.
enum FilmGrainFilter {

    static func apply(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        guard recipe.filmGrain > 0 else { return image }
        let extent = image.extent
        guard extent.width >= 1, extent.height >= 1 else { return image }
        let amt = CGFloat(min(1.0, recipe.filmGrain))

        // Monokromt støy 0…1.
        guard let noise = CIFilter.randomGenerator().outputImage?.cropped(to: extent) else { return image }
        let mono = CIFilter.colorControls()
        mono.inputImage = noise
        mono.saturation = 0
        mono.brightness = 0
        mono.contrast = 1
        guard let gray = mono.outputImage else { return image }

        // Komprimér mot 0.5: ut = 0.5 + (grå−0.5)·k. Soft-light demper kraftig
        // nær midtgrå, så vi trenger romslig amplitude for at kornet skal LESES
        // som film (research: ~2–5 % lysstyrke-variasjon) uten å bli grovt.
        let k = amt * 0.5
        let scale = CIFilter.colorMatrix()
        scale.inputImage = gray
        scale.rVector = CIVector(x: k, y: 0, z: 0, w: 0)
        scale.gVector = CIVector(x: 0, y: k, z: 0, w: 0)
        scale.bVector = CIVector(x: 0, y: 0, z: k, w: 0)
        scale.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
        scale.biasVector = CIVector(x: 0.5 * (1 - k), y: 0.5 * (1 - k), z: 0.5 * (1 - k), w: 0)
        guard let grain = scale.outputImage?.cropped(to: extent) else { return image }

        // Soft-light: grå 0.5 = ingen endring; avvik lysner/mørkner subtilt.
        let blend = CIFilter.softLightBlendMode()
        blend.backgroundImage = image
        blend.inputImage = grain
        return blend.outputImage?.cropped(to: extent) ?? image
    }
}
