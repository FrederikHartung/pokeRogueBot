package com.sfh.pokeRogueBot.model;

import com.sfh.pokeRogueBot.model.enums.CvFilterType;
import lombok.Getter;
import org.opencv.imgproc.Imgproc;

@Getter
public class CvProcessingAlgorithm {
    private final int algorithm;
    private final double threshHold;
    private final CvFilterType filterType;

    private CvProcessingAlgorithm(int algorithm, double threshHold, CvFilterType filterType) {
        this.algorithm = algorithm;
        this.threshHold = threshHold;
        this.filterType = filterType;
    }

    /**
     * Beschreibung: Normalisierte Version von TM_CCOEFF.
     * Einsatzzweck: Bietet stabile Ergebnisse bei unterschiedlichen Helligkeiten und Kontrasten. Höhere Werte sind besser.
     * Threshold: 0.8 oder höher (höher ist besser)
     */
    public static final CvProcessingAlgorithm TM_CCOEFF_NORMED = new CvProcessingAlgorithm(Imgproc.TM_CCOEFF_NORMED, 0.8, CvFilterType.HIGHEST_Result);

    /**
     * Beschreibung: Normalisierte Version von TM_CCORR.
     * Einsatzzweck: Liefert stabilere Ergebnisse, insbesondere bei kleinen Helligkeitsunterschieden. Höhere Werte sind besser.
     * Threshold: 0.8 oder höher (höher ist besser)
     */
    public static final CvProcessingAlgorithm TM_CCORR_NORMED = new CvProcessingAlgorithm(Imgproc.TM_CCORR_NORMED, 0.8, CvFilterType.HIGHEST_Result);


    /**
     * Beschreibung: Berechnet die Summe der quadrierten Differenzen zwischen dem Template und dem Bild.
     * Einsatzzweck: Gut geeignet, wenn Sie nach exakten Übereinstimmungen suchen. Bei dieser Methode sind niedrigere Werte besser.
     * Threshold: 0.1 oder niedriger (niedriger ist besser)
     */
    public static final CvProcessingAlgorithm TM_SQDIFF = new CvProcessingAlgorithm(Imgproc.TM_SQDIFF, 0.1, CvFilterType.LOWEST_Result);

    /**
     * Beschreibung: Ähnlich wie TM_SQDIFF, aber die Ergebnisse werden normalisiert.
     * Einsatzzweck: Bietet stabilere Ergebnisse, besonders bei unterschiedlichen Helligkeiten. Auch hier sind niedrigere Werte besser.
     * Threshold: 0.1 oder niedriger (niedriger ist besser)
     */
    public static final CvProcessingAlgorithm TM_SQDIFF_NORMED = new CvProcessingAlgorithm(Imgproc.TM_SQDIFF_NORMED, 0.1, CvFilterType.LOWEST_Result);

    /**
     * Beschreibung: Berechnet die Kreuzkorrelation zwischen Template und Bild.
     * Einsatzzweck: Gut für Mustererkennung, bei der die Lichtverhältnisse konstant sind. Höhere Werte sind besser.
     * Threshold: 0.8 oder höher (höher ist besser)
     */
    public static final CvProcessingAlgorithm TM_CCORR = new CvProcessingAlgorithm(Imgproc.TM_CCORR, 0.8, CvFilterType.HIGHEST_Result);

    /**
     * Beschreibung: Berechnet die Kreuzkorrelation des Mittelwerts zwischen Template und Bild.
     * Einsatzzweck: Geeignet für Mustererkennung bei konstanten Lichtverhältnissen. Höhere Werte sind besser.
     * Threshold: 0.8 oder höher (höher ist besser)
     */
    public static final CvProcessingAlgorithm TM_CCOEFF = new CvProcessingAlgorithm(Imgproc.TM_CCOEFF, 0.8, CvFilterType.HIGHEST_Result);

}
