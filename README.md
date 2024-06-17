> **This repository is only for educational purpose and can't be used on the original pokeRogue website. 
> You have to clone their repository from "https://github.com/pagefaultgames/pokerogue" and host the game on your local machine to use the bot!**

# PokeRogueBot
This is a bot for the pokeRogue browser game. The Bot reads the current state of the game with the help of JavaScript out of the browser and reacts to it.  

The bot does not cheat or write any values with JavaScript. If the current state of the game is read with JavaScript, the bot processes the information in the Java Part of the application.  

After getting to a Result, the bot calculates which buttons are to press and sends the Commands with the help of Selenium to the browser.  

## Documentation

### How to get started
1. Clone the master Branch of this repository. On the master branch should be the latest stable version of the bot. On the develop branch are the latest features and bugfixes, but there is no guarantee that the bot is working.  
2. Install a Java 17 SDK, Maven (Java Build Tool), Intellij Idea (Java IDE) and Chrome (Browser).
3. Clone the master Branch of the pokeRogue repository from "https://github.com/pagefaultgames/pokerogue". Read the README.md of the pokeRogue repository to get the game running on your local machine.
4. Optional: Add a custom Chrome Profile to the bot. Read the section "How to add a chrome profile to persist the settings chosen in the title menu" to get more information.
5. Open this repository in Intellij Idea and run the Application class. The bot should start and connect to the browser.

## Hows does the bot work
Currently the bot implementation is very simple. It choses the first attack and tries to pick a potion item and apply it to the first pokemon in the team. This is done, till the player team is beaten.  
I am working on improving the bot and adding more features.

## How to add a chrome profile to persist the settings chosen in the title menu
It is possible to add a Chrome Profile to the bot. The advantage is, that you can open the browser with the profile and choose the settings in the title menu like game speed or show tutorials.  
I recommend it to give the bot a Chrome Profile.

### How to add a Chrome Profile:
Create a new "application-default.yml" file in the resources folder of the bot repository. This default file overrides the values in the application.yml file.  
You can add your own configurations in this file. The application-default file won't be pushed to the repository or won't be overriden on pulling changes.  
1. Open Chrome, click on the profile icon in the top right corner and click on "Add". Follow the steps to create a new Chrome Profile.
2. If the profile is created, make sure to switch to the new profile.
3. Type "chrome://version/" in the address bar and press enter. You find the Profile path there. The last part of the path is the name of the Chrome Profile. 

Add following text to the application-default.yml file. Replace the values with your values. This value are just an example:
browser:
  pathChromeUserDir: "/Users/yourUserName/Library/Application Support/Google/Chrome/" #profile path without the profile name!!!
  chromeProfile: "Profile 5" #profile name without the directory path!!!

Use the proper indentation like in the "application.yml" file. If you don't add this property, the bot will start a new Chrome Profile.
After that, you can switch back to your normal Chrome Profile and start the bot. The bot should open the browser with the new profile you added.








   

