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

## Hows does the bot work
The bots tries so find the templates on the screen with following methods:
HtmlTeplate: The bot tries to find the HtmlTemplate with the x_path in the body.
CvTemplate: The bot tries to find the CvTemplate with the OpenCV TemplateMatching algorithm.
OcrTemplate: The bot tries to find the OcrTemplate with the tesseract OCR engine.

For each CvTemplate a screenshot with the picture to find in the Canvas screenshot has to be provided in the data/templates folder.
Templates have to be added to their corresponding stage where they are visible for validation if they are visible.
Every Stage needs to be a component for automatic path checking if the templates are present on the disc.  

## Development Strategy
Focus on progress and not on perfection. It's better to stick to a bad implementation and improve it later than to try to make it perfect from the beginning.  
If a good idea comes up, write it down and implement it later. Focus on the current task. Order the tasks by their level of improvement and how easy they are to implement.  
Only refactor, when it's really necessary.

## todo
- [x] make first attack
- [x] handle the reaction of the opponent
- [x] attack till the first opponent is beaten
- [x] handle the start of the second fight
- [x] handle trainer fights
- [x] enemy fainted stage
- [x] dynamic wait times after stages
- [x] find good waittimes for each stage
- [ ] handle shop
- [ ] add ocr unit tests
- [ ] handle switching of the pokemon if one is down
- [ ] notice if the enemy is a wild pokemon or a trainer
- [ ] catch one pokemon
- [ ] press c for starts
- [ ] press v for variants/battle effects/enemy abilities


   

