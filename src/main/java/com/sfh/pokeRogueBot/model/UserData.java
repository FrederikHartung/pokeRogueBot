package com.sfh.pokeRogueBot.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserData {
    private String username;
    private String password;
    private boolean isActive;
}
