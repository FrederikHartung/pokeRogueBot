if(!window.poru) window.poru = {};
window.poru.util = {
    getPhaseName: function getPhase() {
        console.log("abcdefgssfhgsgh");
        console.log(Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name);
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name;
    },

    getGameMode: function getGameMode() {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getMode();
    }
}