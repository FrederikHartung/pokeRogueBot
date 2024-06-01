# pokeRogueBot
This is a Repository for different bots which plays the pokeRogue Browser game with the help of AI.  

Currently the bot uses the tesseract OCR engine to read text, OpenCV for TemplateMatching and the selenium web driver to interact with the game.

## Documentation

### How to get started
1. Install tesseract on your system and download the language files for the language you want to use.
for macOs:
brew install tesseract
2. Set the tesseract values in the application.yml file, for example:
   ocr:
   language: deu
   datapath: /opt/homebrew/Cellar/tesseract/5.3.4_1/share/tessdata
   jnaLibraryPath: /opt/homebrew/opt/tesseract/lib/
3. Install Chrome if not present on your machine
2. Install a Java 17 SDK
3. Install maven
4. Request the .png Templates for the template classes from me if you want to use my screenshots  
or make your own screenshots and save them in the data/templates folder. You find the expected paths for each template in the template classes.


## todo
-if i make a screenshot for a template from a already existing gamescreenshot, the new screenshot is twice the size
-validate, if the first todo is linked to the display size of my machine


   

