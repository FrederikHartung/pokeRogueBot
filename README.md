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
4. Open this repository in Intellij Idea and run the Application class. The bot should start and connect to the browser.

## Hows does the bot work
Currently the bot implementation is very simple. It choses the first attack and tries to pick a potion item and apply it to the first pokemon in the team. This is done, till the player team is beaten.  
I am working on improving the bot and adding more features.





   

