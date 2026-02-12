package com.sfh.pokeRogueBot.model

import java.io.File


class FileWrapper(val pathname: String){

    fun listFiles(): Array<File?>? {
        return File(pathname).listFiles()
    }
}