package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.ShopData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class JsService {

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public ShopData getShopData(){
        return jsClient.getShopData();
    }
}
