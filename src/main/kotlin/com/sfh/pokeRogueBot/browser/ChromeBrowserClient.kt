package com.sfh.pokeRogueBot.browser

import org.openqa.selenium.By
import org.openqa.selenium.JavascriptExecutor
import org.openqa.selenium.JavascriptException
import org.openqa.selenium.NoSuchElementException
import org.openqa.selenium.NoSuchWindowException
import org.openqa.selenium.OutputType
import org.openqa.selenium.WebDriver
import org.openqa.selenium.WebElement
import org.openqa.selenium.chrome.ChromeDriver
import org.openqa.selenium.chrome.ChromeOptions
import org.openqa.selenium.remote.UnreachableBrowserException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO

@Component
@Primary
class ChromeBrowserClient(
    @Value("\${browser.closeOnExit:false}") private val closeOnExit: Boolean,
    @Value("\${browser.waitTimeForRenderAfterNavigation:5000}") private val waitTimeForRenderAfterNavigation: Int,
    @Value("\${browser.pathChromeUserDir}") private val pathChromeUserDir: String?,
    @Value("\${browser.chromeProfile}") private val chromeProfile: String?,
) : DisposableBean, BrowserClient, ImageService, JsClient {

    companion object {
        private val log = LoggerFactory.getLogger(ChromeBrowserClient::class.java)
    }

    /**
     * The instance of the WebDriver is created when first time calling navigateTo()
     */
    private var driver: WebDriver? = null

    override fun navigateTo(targetUrl: String?) {
        val url = requireNotNull(targetUrl) { "targetUrl must not be null" }
        if (driver == null) {
            val options = ChromeOptions()

            // Disable network-related features to speed up startup, especially on poor connections
            options.addArguments("--disable-extensions")
            options.addArguments("--disable-component-update")
            options.addArguments("--disable-background-networking")
            options.addArguments("--disable-sync")
            options.addArguments("--disable-translate")
            options.addArguments("--disable-domain-reliability")
            options.addArguments("--disable-client-side-phishing-detection")
            options.addArguments("--disable-dev-shm-usage")
            options.addArguments("--no-sandbox")

            if (!pathChromeUserDir.isNullOrEmpty()) {
                log.debug("Using Chrome user dir: {} and profile: {}", pathChromeUserDir, chromeProfile)
                options.addArguments("user-data-dir=$pathChromeUserDir")
                options.addArguments("--profile-directory=$chromeProfile")
            }
            log.debug("Creating Chrome driver")
            driver = ChromeDriver(options)
            log.debug("Chrome driver created")
        }

        driver!!.get(url)
        log.debug("Navigated to {}", url)

        try {
            Thread.sleep(waitTimeForRenderAfterNavigation.toLong())
        } catch (e: InterruptedException) {
            log.error("Error while waiting, error: {}", e.message)
        }
    }

    private fun getCanvas(): WebElement = driver!!.findElement(By.tagName("canvas"))

    override fun getElementByXpath(xpath: String): WebElement = driver!!.findElement(By.xpath(xpath))

    override fun destroy() {
        try {
            if (closeOnExit && driver != null) {
                driver!!.quit()
                log.debug("Browser closed")
            }
        } catch (e: Exception) {
            val message = e.message
            if (message != null && message.contains("Timed out waiting for driver server to stop")) {
                log.warn("Error while closing browser: Timed out waiting for driver server to stop.")
            } else {
                log.error("Error while closing browser: {}", message)
            }
        }
    }

    @Throws(IOException::class)
    override fun takeScreenshot(): BufferedImage {
        // find the canvas element
        val canvasElement = getCanvas()

        // make screenshot of the canvas element
        val screenshotBytes = canvasElement.getScreenshotAs(OutputType.BYTES)

        // convert the byte array to a BufferedImage
        ByteArrayInputStream(screenshotBytes).use { bais ->
            return ImageIO.read(bais)
        }
    }

    override fun addScriptToWindow(jsFilePath: Path) {
        try {
            val js = driver as JavascriptExecutor
            val jsCode = String(Files.readAllBytes(jsFilePath))
            js.executeScript(jsCode)
        } catch (e: NoSuchWindowException) {
            log.error("Browser window not found.")
            throw e
        } catch (e: UnreachableBrowserException) {
            log.error("Browser unreachable.")
            throw e
        } catch (e: Exception) {
            log.error("Error while adding script to window: {}, error: {}", jsFilePath, e.message)
        }
    }

    override fun executeCommandAndGetResult(jsCommand: String): Any? {
        return try {
            val js = driver as JavascriptExecutor
            js.executeScript(jsCommand)
        } catch (e: NoSuchWindowException) {
            log.error("browser window not found, error: {}", e.message)
            throw e
        } catch (e: UnreachableBrowserException) {
            log.error("browser unreachable, error: {}", e.message)
            throw e
        } catch (e: JavascriptException) {
            val message = e.message
            // Extract just the core error message without full stack trace
            if (message != null && message.contains("javascript error: ")) {
                var coreError = message.substring(message.indexOf("javascript error: ") + 18)
                if (coreError.contains("\n")) {
                    coreError = coreError.substring(0, coreError.indexOf("\n"))
                }
                log.error("JavaScript error: {} (command: {})", coreError, jsCommand)
            } else {
                log.error("JavaScript Exception: {} (command: {})", message, jsCommand)
            }
            throw e
        } catch (e: Exception) {
            log.error("Error while executing JS command: {}, error: {}", jsCommand, e.message)
            null
        }
    }

    override fun enterUserData(userName: String, password: String): Boolean {
        val userNameXpath = "//*[@id=\"app\"]/div/input[1]"
        val passwordXpath = "//*[@id=\"app\"]/div/input[2]"

        return try {
            val userNameElement = getElementByXpath(userNameXpath)
            userNameElement.sendKeys(userName)
            val passwordElement = getElementByXpath(passwordXpath)
            passwordElement.sendKeys(password)
            true
        } catch (e: NoSuchElementException) {
            log.error("Error while entering user data: {}", e.message)
            false
        }
    }
}
