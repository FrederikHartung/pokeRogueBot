var currentBattle = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle;;
var formsDto = [];

if(currentBattle){
    var enemyParty = currentBattle.enemyParty;
    if(enemyParty){
        var enemyPokemon = enemyParty[0];
        if(enemyPokemon){
            var formIndex = enemyPokemon.formIndex;
            var enemyForms = enemyPokemon.species.forms;

            for(var i = 0; i < enemyForms.length; i++){

                var form = enemyForms[i];
                var formDto = { 
                    type1: form.type1,
                    type2: form.type2,
                };

                formsDto.push(formDto);
            }
        }
    }
}

console.log(formsDto);