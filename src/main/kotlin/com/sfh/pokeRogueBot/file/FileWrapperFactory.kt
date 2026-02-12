package com.sfh.pokeRogueBot.file

import com.sfh.pokeRogueBot.model.FileWrapper

class FileWrapperFactory {

    fun get(pathname:String): FileWrapper {
        return FileWrapper(pathname)
    }
}