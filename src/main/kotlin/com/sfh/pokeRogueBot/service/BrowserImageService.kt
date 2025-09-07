package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.browser.ImageClient
import com.sfh.pokeRogueBot.model.exception.ImageValidationException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.awt.RenderingHints
import java.awt.geom.AffineTransform
import java.awt.image.BufferedImage
import java.io.IOException

@Service
class BrowserImageService(private val imageClient: ImageClient) : ImageService {

    companion object {
        private val log = LoggerFactory.getLogger(BrowserImageService::class.java)

        private const val STANDARDISED_CANVAS_WIDTH = 1480
        private const val STANDARDISED_CANVAS_HEIGHT = 830

        @JvmStatic
        @Throws(ImageValidationException::class)
        fun validateImage(image: BufferedImage, filenamePrefix: String) {
            if (image.width != STANDARDISED_CANVAS_WIDTH || image.height != STANDARDISED_CANVAS_HEIGHT) {
                throw ImageValidationException(
                    "Image has wrong dimensions: ${image.width}x${image.height}, " +
                            "expected: ${STANDARDISED_CANVAS_WIDTH}x${STANDARDISED_CANVAS_HEIGHT}"
                )
            }

            if (image.type != BufferedImage.TYPE_3BYTE_BGR) {
                throw ImageValidationException(
                    "Image has wrong color type: ${checkColorType(image)}, filenamePrefix: $filenamePrefix"
                )
            }
        }

        private fun checkColorType(image: BufferedImage): String {
            return when (image.type) {
                BufferedImage.TYPE_3BYTE_BGR -> "TYPE_3BYTE_BGR"
                BufferedImage.TYPE_4BYTE_ABGR -> "TYPE_4BYTE_ABGR"
                BufferedImage.TYPE_INT_RGB -> "TYPE_INT_RGB"
                BufferedImage.TYPE_INT_ARGB -> "TYPE_INT_ARGB"
                BufferedImage.TYPE_BYTE_GRAY -> "TYPE_BYTE_GRAY"
                BufferedImage.TYPE_USHORT_GRAY -> "TYPE_USHORT_GRAY"
                else -> "Other type: ${image.type}"
            }
        }

        @JvmStatic
        fun removeAlphaChannel(image: BufferedImage): BufferedImage {
            return if (image.type == BufferedImage.TYPE_4BYTE_ABGR) {
                val newImage = BufferedImage(image.width, image.height, BufferedImage.TYPE_3BYTE_BGR)
                val g = newImage.createGraphics()
                g.drawImage(image, 0, 0, null)
                g.dispose()
                newImage
            } else {
                image
            }
        }
    }

    /**
     * Takes a screenshot from the canvas and scales it to the standardised canvas size.
     * The canvas size can change depending on the screen size or resolution.
     */
    @Throws(ImageValidationException::class, IOException::class)
    override fun takeScreenshot(filenamePrefix: String): BufferedImage {
        val canvas = imageClient.takeScreenshotFromCanvas()

        var scaledImage = scaleImage(canvas)
        scaledImage = removeAlphaChannel(scaledImage)

        validateImage(scaledImage, filenamePrefix)

        return scaledImage
    }

    private fun scaleImage(originalImage: BufferedImage): BufferedImage {
        val newWidth = STANDARDISED_CANVAS_WIDTH
        val newHeight = STANDARDISED_CANVAS_HEIGHT

        val scaledImage = BufferedImage(newWidth, newHeight, BufferedImage.TYPE_3BYTE_BGR)
        val g2d = scaledImage.createGraphics()

        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val scaleFactorX = newWidth / originalImage.width.toDouble()
        val scaleFactorY = newHeight / originalImage.height.toDouble()

        val affineTransform = AffineTransform.getScaleInstance(scaleFactorX, scaleFactorY)
        g2d.drawRenderedImage(originalImage, affineTransform)
        g2d.dispose()

        return scaledImage
    }
}