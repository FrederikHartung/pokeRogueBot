package com.sfh.pokeRogueBot.file;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Iv;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.enums.Stat;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.Nonnull;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.StringJoiner;

@Component
@Slf4j
public class FileManager {

    public static final String IMAGE_IO_FILE_EXTENSION = "png";
    public static final String SCREENSHOT_FILE_EXTENSION = ".png";
    public static final String DIR_TEMP = Paths.get(".", "data", "temp").toString();
    public static final String DIR_SAVE = Paths.get(".", "data", "save").toString();
    public static final Path FILE_HATCHED_POKEMON = Paths.get(".", "data", "save", "hatched_pokemon.txt");
    private int fileIndex = 0;

    public void deleteTempData() {
        File folder = new File(getScreenshotTempDirPath());
        File[] files = folder.listFiles();
        if (files == null) {
            return;
        }

        for (File file : files) {
            if (null == file) {
                continue;
            }

            if (file.isFile()) {
                try {
                    Files.deleteIfExists(file.toPath());
                } catch (Exception e) {
                    log.error("Could not delete file: " + file.getName());
                }
            }
        }
    }

    public void saveTempImage(BufferedImage bufferedImage, String fileNamePrefix) {
        String filePath = getTempFilePath(fileNamePrefix);

        try {
            if (Files.notExists(getTempDir())) {
                Files.createDirectories(getTempDir());
            }
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, new File(filePath));
            fileIndex++;
            log.info("Temp Screenshot persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while saving temp screenshot to: " + filePath, e);
        }
    }

    public void persistImage(BufferedImage bufferedImage, String prefix) {
        String filePath = getSaveFilePath(prefix);

        try {
            if (Files.notExists(getSaveDir())) {
                Files.createDirectories(getSaveDir());
            }
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, new File(filePath));
            fileIndex++;
            log.info("Screenshot persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while saving screenshot to: " + filePath, e);
        }
    }

    /**
     * Returns the directory path for saving temporary screenshots.
     * @return the directory path plus a file separator for the corresponding OS
     */
    public String getScreenshotTempDirPath() {
        return DIR_TEMP + File.separator;
    }

    /**
     * Returns the file path for the given file name prefix for saving screenshots.
     * @param fileNamePrefix a custom filename prefix
     * @return the file path where the screenshot will be saved
     */
    public String getTempFilePath(String fileNamePrefix) {
        return DIR_TEMP + File.separator + fileIndex + "_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION;
    }

    public String getSaveFilePath(String fileNamePrefix) {
        String dateTimeAsString = getDateTimestamp();
        return DIR_SAVE + File.separator + dateTimeAsString + "_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION;
    }

    public Path getTempDir(){
        return Paths.get(DIR_TEMP + File.separator);
    }

    public Path getSaveDir(){
        return Paths.get(DIR_SAVE + File.separator);
    }

    public void persistHatchedPokemon(@Nonnull Pokemon pokemon){
        StringJoiner message = new StringJoiner(", ");
        message.add(getDateTimestamp());
        message.add(pokemon.getName());
        message.add("id: " + pokemon.getSpecies().getSpeciesId());
        message.add("shiny: " + pokemon.isShiny());
        message.add("ability hidden index: " + pokemon.getSpecies().getAbilityHidden());
        message.add("legendary: " + pokemon.getSpecies().isLegendary());
        message.add("sub legendary: " + pokemon.getSpecies().isSubLegendary());
        message.add("mystical: " + pokemon.getSpecies().isMythical());
        message.add("base stats total: " + pokemon.getSpecies().getBaseTotal());

        Stats baseStats = pokemon.getSpecies().getBaseStats();
        message.add("base stats: hp: " + baseStats.getHp());
        message.add("atk: " + baseStats.getAttack());
        message.add("def: " + baseStats.getDefense());
        message.add("spAtk: " + baseStats.getSpecialAttack());
        message.add("spDef: " + baseStats.getSpecialDefense());
        message.add("speed: " + baseStats.getSpeed());

        Iv iv = pokemon.getIvs();
        message.add("IVs: hp: " + iv.getHp());
        message.add("atk: " + iv.getAttack());
        message.add("def: " + iv.getDefense());
        message.add("spAtk: " + iv.getSpecialAttack());
        message.add("spDef: " + iv.getSpecialDefense());
        message.add("speed: " + iv.getSpeed());

        try {
            Path parentDir = FILE_HATCHED_POKEMON.getParent();
            if (!Files.exists(parentDir)) {
                Files.createDirectories(parentDir);
            }

            if(Files.notExists(FILE_HATCHED_POKEMON)){
                Files.createFile(FILE_HATCHED_POKEMON);
            }

            //append the message to the file
            Files.writeString(FILE_HATCHED_POKEMON, message.toString() + System.lineSeparator(), java.nio.file.StandardOpenOption.APPEND);
        }
        catch (Exception e){
            log.error("Error while saving hatched pokemon", e);
        }
    }

    private String getDateTimestamp(){
        String datetimeFormat = "yyyy-MM-dd_HH-mm-ss";
        return LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern(datetimeFormat));
    }
}
